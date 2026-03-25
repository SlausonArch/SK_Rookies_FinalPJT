package com.rookies.sk.service;

import com.rookies.sk.dto.*;
import com.rookies.sk.entity.Comment;
import com.rookies.sk.entity.CommunityLike;
import com.rookies.sk.entity.Member;
import com.rookies.sk.entity.Post;
import com.rookies.sk.repository.CommentRepository;
import com.rookies.sk.repository.CommunityLikeRepository;
import com.rookies.sk.repository.MemberRepository;
import com.rookies.sk.repository.PostRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.EntityManager;
import org.jsoup.Jsoup;
import org.jsoup.safety.Safelist;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class CommunityService {

    private final PostRepository postRepository;
    private final CommentRepository commentRepository;
    private final CommunityLikeRepository communityLikeRepository;
    private final MemberRepository memberRepository;
    private final EntityManager entityManager;

    @Transactional(readOnly = true)
    public List<PostResponseDto> getPosts(String keyword, String currentEmail) {
        Member currentMember = findCurrentMemberOrNull(currentEmail);
        boolean isAdmin = currentMember != null && hasCommunitySuperRole(currentMember);
        Long currentMemberId = currentMember != null ? currentMember.getMemberId() : null;

        // 로그 인젝션 방지: CRLF 제거 후 DEBUG 레벨로만 기록 (CWE-117)
        if (log.isDebugEnabled()) {
            String safeKeyword = keyword == null ? "" : keyword.replaceAll("[\r\n\t]", " ");
            log.debug("Community search keyword: [{}]", safeKeyword);
        }

        List<Post> posts;

        if (keyword == null || keyword.isBlank()) {
            if (isAdmin) {
                posts = postRepository.findAll();
            } else {
                posts = postRepository.findByIsHidden("N");
            }
        } else {
            String escapedKeyword = keyword.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
            String likePattern = "%" + escapedKeyword + "%";

            String jpql;
            if (isAdmin) {
                jpql = "SELECT p FROM Post p WHERE LOWER(p.title) LIKE LOWER(:pattern) ESCAPE '\\' " +
                       "OR p.content LIKE :pattern ESCAPE '\\' " +
                       "ORDER BY CASE WHEN p.isNotice = 'Y' THEN 0 ELSE 1 END, p.createdAt DESC";
            } else {
                jpql = "SELECT p FROM Post p WHERE (LOWER(p.title) LIKE LOWER(:pattern) ESCAPE '\\' " +
                       "OR p.content LIKE :pattern ESCAPE '\\') " +
                       "AND p.isHidden = 'N' " +
                       "ORDER BY CASE WHEN p.isNotice = 'Y' THEN 0 ELSE 1 END, p.createdAt DESC";
            }

            try {
                posts = entityManager.createQuery(jpql, Post.class)
                        .setParameter("pattern", likePattern)
                        .getResultList();
            } catch (Exception e) {
                log.error("QUERY ERROR: {}", e.getMessage());
                posts = List.of();
            }
        }
        posts = sortPosts(posts);

        return posts.stream()
                .map(post -> toPostResponse(post, currentMemberId, isAdmin))
                .collect(Collectors.toList());
    }

    @Transactional
    public PostResponseDto getPost(Long postId, String currentEmail) {
        Member currentMember = findCurrentMemberOrNull(currentEmail);
        boolean isAdmin = currentMember != null && hasCommunitySuperRole(currentMember);
        Long currentMemberId = currentMember != null ? currentMember.getMemberId() : null;

        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("Post not found"));

        if (!isAdmin && "Y".equals(post.getIsHidden())) {
            throw new IllegalArgumentException("Post is hidden");
        }

        post.setViewCount(post.getViewCount() + 1);
        return toPostResponse(post, currentMemberId, isAdmin);
    }

    @Transactional
    public PostResponseDto createPost(PostRequestDto request, String currentEmail) {
        Member member = findCurrentMember(currentEmail);

        if (request.isNotice() && !hasCommunitySuperRole(member)) {
            throw new IllegalArgumentException("Only admin can create notices");
        }

        Post post = Post.builder()
                .member(member)
                .title(sanitizeText(request.getTitle()))
                .content(sanitizeText(request.getContent()))
                .attachmentUrl(request.getAttachmentUrl())
                .isNotice(request.isNotice() ? "Y" : "N")
                .isHidden("N")
                .build();

        Post saved = postRepository.save(post);
        return toPostResponse(saved, member.getMemberId(), hasCommunitySuperRole(member));
    }

    @Transactional
    public PostResponseDto updatePost(Long postId, PostRequestDto request, String currentEmail) {
        Member member = findCurrentMember(currentEmail);
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("Post not found"));

        if (!canManagePost(post, member)) {
            throw new IllegalArgumentException("No permission");
        }

        if (request.isNotice() && !hasCommunitySuperRole(member)) {
            throw new IllegalArgumentException("Only admin can set notice");
        }

        post.setTitle(sanitizeText(request.getTitle()));
        post.setContent(sanitizeText(request.getContent()));
        post.setAttachmentUrl(request.getAttachmentUrl());
        post.setIsNotice(request.isNotice() ? "Y" : "N");

        return toPostResponse(post, member.getMemberId(), hasCommunitySuperRole(member));
    }

    @Transactional
    public void deletePost(Long postId, String currentEmail) {
        Member member = findCurrentMember(currentEmail);
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("Post not found"));

        if (!canManagePost(post, member)) {
            throw new IllegalArgumentException("No permission");
        }

        commentRepository.deleteByPost_PostId(postId);
        postRepository.delete(post);
    }

    @Transactional(readOnly = true)
    public List<CommentResponseDto> getComments(Long postId, String currentEmail) {
        Member currentMember = findCurrentMemberOrNull(currentEmail);
        boolean isAdmin = currentMember != null && hasCommunitySuperRole(currentMember);
        Long currentMemberId = currentMember != null ? currentMember.getMemberId() : null;

        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("Post not found"));
        Long postAuthorId = post.getMember() != null ? post.getMember().getMemberId() : null;

        return commentRepository.findByPost_PostIdOrderByCreatedAtAsc(postId).stream()
                .map(comment -> toCommentResponse(comment, currentMemberId, postAuthorId, isAdmin))
                .collect(Collectors.toList());
    }

    @Transactional
    public CommentResponseDto addComment(Long postId, CommentRequestDto request, String currentEmail) {
        Member member = findCurrentMember(currentEmail);
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("Post not found"));

        // isHidden 필드를 비밀 댓글 여부로 활용
        String isHidden = request.isSecret() ? "Y" : "N";

        Comment comment = Comment.builder()
                .post(post)
                .member(member)
                .content(sanitizeText(request.getContent()))
                .isHidden(isHidden)
                .build();

        Comment saved = commentRepository.save(comment);
        Long postAuthorId = post.getMember() != null ? post.getMember().getMemberId() : null;
        return toCommentResponse(saved, member.getMemberId(), postAuthorId, hasCommunitySuperRole(member));
    }

    @Transactional
    public CommentResponseDto updateComment(Long commentId, CommentRequestDto request, String currentEmail) {
        Member member = findCurrentMember(currentEmail);
        Comment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new IllegalArgumentException("Comment not found"));

        Long ownerId = comment.getMember() != null ? comment.getMember().getMemberId() : null;
        boolean canEdit = hasCommunitySuperRole(member) || (ownerId != null && ownerId.equals(member.getMemberId()));
        if (!canEdit) {
            throw new IllegalArgumentException("No permission");
        }

        comment.setContent(sanitizeText(request.getContent()));
        Long postAuthorId = comment.getPost() != null && comment.getPost().getMember() != null
                ? comment.getPost().getMember().getMemberId() : null;
        return toCommentResponse(comment, member.getMemberId(), postAuthorId, hasCommunitySuperRole(member));
    }

    @Transactional
    public void deleteComment(Long commentId, String currentEmail) {
        Member member = findCurrentMember(currentEmail);
        Comment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new IllegalArgumentException("Comment not found"));

        Long ownerId = comment.getMember() != null ? comment.getMember().getMemberId() : null;
        boolean canDelete = hasCommunitySuperRole(member) || (ownerId != null && ownerId.equals(member.getMemberId()));
        if (!canDelete) {
            throw new IllegalArgumentException("No permission");
        }

        commentRepository.delete(comment);
    }

    @Transactional
    public long likePost(Long postId, String currentEmail) {
        Member member = findCurrentMember(currentEmail);
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("Post not found"));

        boolean exists = communityLikeRepository.existsByTargetTypeAndTargetIdAndMember_MemberId(
                "POST", postId, member.getMemberId());
        if (exists) {
            communityLikeRepository.deleteByTargetTypeAndTargetIdAndMember_MemberId(
                    "POST", postId, member.getMemberId());
        } else {
            CommunityLike like = CommunityLike.builder()
                    .targetType("POST")
                    .targetId(postId)
                    .member(member)
                    .build();
            communityLikeRepository.save(like);
        }

        long count = communityLikeRepository.countByTargetTypeAndTargetId("POST", postId);
        post.setLikeCount(count);
        return count;
    }

    @Transactional
    public Member updateMemberStatus(Long memberId, MemberStatusRequestDto request, String currentEmail) {
        Member actor = findCurrentMember(currentEmail);
        if (!isAdmin(actor)) {
            throw new IllegalArgumentException("Admin only");
        }

        Member target = memberRepository.findById(memberId)
                .orElseThrow(() -> new IllegalArgumentException("Member not found"));

        target.setStatus(Member.Status.valueOf(request.getStatus().toUpperCase()));
        return target;
    }

    private PostResponseDto toPostResponse(Post post, Long currentMemberId, boolean isAdmin) {
        Long ownerId = post.getMember() != null ? post.getMember().getMemberId() : null;
        boolean canEdit = isAdmin || (ownerId != null && ownerId.equals(currentMemberId));
        long commentCount = commentRepository.countByPost_PostId(post.getPostId());

        String authorName = resolveDisplayName(post.getMember());

        return PostResponseDto.builder()
                .postId(post.getPostId())
                .memberId(ownerId)
                .authorName(authorName)
                .title(post.getTitle())
                .content(post.getContent())
                .attachmentUrl(post.getAttachmentUrl())
                .notice("Y".equals(post.getIsNotice()))
                .hidden("Y".equals(post.getIsHidden()))
                .viewCount(post.getViewCount() == null ? 0L : post.getViewCount())
                .likeCount(post.getLikeCount() == null ? 0L : post.getLikeCount())
                .commentCount(commentCount)
                .createdAt(post.getCreatedAt())
                .updatedAt(post.getUpdatedAt())
                .canEdit(canEdit)
                .canDelete(canEdit)
                .userLiked(hasUserLiked(post.getPostId(), currentMemberId))
                .build();
    }

    private CommentResponseDto toCommentResponse(Comment comment, Long currentMemberId, Long postAuthorId, boolean isAdmin) {
        Long ownerId = comment.getMember() != null ? comment.getMember().getMemberId() : null;
        boolean canEdit = isAdmin || (ownerId != null && ownerId.equals(currentMemberId));
        boolean canDelete = canEdit;
        boolean isSecret = "Y".equals(comment.getIsHidden());

        // 비밀 댓글: 작성자, 게시글 작성자, 관리자만 내용 조회 가능
        boolean canViewSecret = isAdmin
                || (ownerId != null && ownerId.equals(currentMemberId))
                || (postAuthorId != null && postAuthorId.equals(currentMemberId));
        String content = (isSecret && !canViewSecret) ? "비밀 댓글입니다." : comment.getContent();

        String authorName = resolveDisplayName(comment.getMember());

        return CommentResponseDto.builder()
                .commentId(comment.getCommentId())
                .memberId(ownerId)
                .authorName(authorName)
                .content(content)
                .createdAt(comment.getCreatedAt())
                .canDelete(canDelete)
                .isSecret(isSecret)
                .canEdit(canEdit)
                .build();
    }

    private boolean canManagePost(Post post, Member member) {
        if (hasCommunitySuperRole(member)) {
            return true;
        }
        if (post.getMember() == null) {
            return false;
        }
        return post.getMember().getMemberId().equals(member.getMemberId());
    }

    private Member findCurrentMember(String email) {
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("Authentication required");
        }
        return memberRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Member not found"));
    }

    private Member findCurrentMemberOrNull(String email) {
        if (email == null || email.isBlank()) {
            return null;
        }
        return memberRepository.findByEmail(email).orElse(null);
    }

    private boolean isAdmin(Member member) {
        return member.getRole() == Member.Role.VCESYS_CORE;
    }

    private boolean hasCommunitySuperRole(Member member) {
        return member.getRole() == Member.Role.VCESYS_CORE;
    }

    /** HTML 태그 전체 제거 — Stored XSS 방지 */
    private String sanitizeText(String input) {
        if (input == null) return null;
        return Jsoup.clean(input, Safelist.none());
    }

    private String normalizeKeyword(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return null;
        }
        return keyword.trim();
    }

    private String resolveDisplayName(Member member) {
        if (member == null) {
            return "탈퇴회원";
        }

        // 관리자 역할은 실제 이름 노출 방지
        if (member.getRole() == Member.Role.VCESYS_CORE
                || member.getRole() == Member.Role.VCESYS_MGMT
                || member.getRole() == Member.Role.VCESYS_EMP) {
            return "관리자";
        }

        String name = member.getName();
        if (name != null && !name.isBlank() && !name.replace("?", "").isBlank()) {
            return name;
        }

        String email = member.getEmail();
        if (email != null && !email.isBlank()) {
            return email;
        }

        return "알수없음";
    }

    private boolean hasUserLiked(Long postId, Long memberId) {
        if (memberId == null) {
            return false;
        }
        return communityLikeRepository.existsByTargetTypeAndTargetIdAndMember_MemberId("POST", postId, memberId);
    }

    private List<Post> sortPosts(List<Post> posts) {
        return posts.stream()
                .sorted(
                        Comparator
                                .comparing((Post p) -> "Y".equals(p.getIsNotice()) ? 0 : 1)
                                .thenComparing(Post::getCreatedAt,
                                        Comparator.nullsLast(Comparator.reverseOrder()))
                                .thenComparing(Post::getPostId,
                                        Comparator.nullsLast(Comparator.reverseOrder())))
                .collect(Collectors.toList());
    }
}
