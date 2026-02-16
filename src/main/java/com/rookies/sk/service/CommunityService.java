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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CommunityService {

    private final PostRepository postRepository;
    private final CommentRepository commentRepository;
    private final CommunityLikeRepository communityLikeRepository;
    private final MemberRepository memberRepository;

    @Transactional(readOnly = true)
    public List<PostResponseDto> getPosts(String keyword, String currentEmail) {
        Member currentMember = findCurrentMemberOrNull(currentEmail);
        boolean isAdmin = currentMember != null && isAdmin(currentMember);
        Long currentMemberId = currentMember != null ? currentMember.getMemberId() : null;

        List<Post> posts = isAdmin
                ? postRepository.searchAllPostsForAdmin(normalizeKeyword(keyword))
                : postRepository.searchVisiblePosts(normalizeKeyword(keyword));

        return posts.stream()
                .map(post -> toPostResponse(post, currentMemberId, isAdmin))
                .collect(Collectors.toList());
    }

    @Transactional
    public PostResponseDto getPost(Long postId, String currentEmail) {
        Member currentMember = findCurrentMemberOrNull(currentEmail);
        boolean isAdmin = currentMember != null && isAdmin(currentMember);
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

        if (request.isNotice() && !isAdmin(member)) {
            throw new IllegalArgumentException("Only admin can create notices");
        }

        Post post = Post.builder()
                .member(member)
                .title(request.getTitle())
                .content(request.getContent())
                .attachmentUrl(request.getAttachmentUrl())
                .isNotice(request.isNotice() ? "Y" : "N")
                .isHidden("N")
                .build();

        Post saved = postRepository.save(post);
        return toPostResponse(saved, member.getMemberId(), isAdmin(member));
    }

    @Transactional
    public PostResponseDto updatePost(Long postId, PostRequestDto request, String currentEmail) {
        Member member = findCurrentMember(currentEmail);
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("Post not found"));

        if (!canManagePost(post, member)) {
            throw new IllegalArgumentException("No permission");
        }
        if (request.isNotice() && !isAdmin(member)) {
            throw new IllegalArgumentException("Only admin can set notice");
        }

        post.setTitle(request.getTitle());
        post.setContent(request.getContent());
        post.setAttachmentUrl(request.getAttachmentUrl());
        post.setIsNotice(request.isNotice() ? "Y" : "N");

        return toPostResponse(post, member.getMemberId(), isAdmin(member));
    }

    @Transactional
    public void deletePost(Long postId, String currentEmail) {
        Member member = findCurrentMember(currentEmail);
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("Post not found"));

        if (!canManagePost(post, member)) {
            throw new IllegalArgumentException("No permission");
        }

        postRepository.delete(post);
    }

    @Transactional(readOnly = true)
    public List<CommentResponseDto> getComments(Long postId, String currentEmail) {
        Member currentMember = findCurrentMemberOrNull(currentEmail);
        boolean isAdmin = currentMember != null && isAdmin(currentMember);
        Long currentMemberId = currentMember != null ? currentMember.getMemberId() : null;

        return commentRepository.findByPost_PostIdOrderByCreatedAtAsc(postId).stream()
                .map(comment -> toCommentResponse(comment, currentMemberId, isAdmin))
                .collect(Collectors.toList());
    }

    @Transactional
    public CommentResponseDto addComment(Long postId, CommentRequestDto request, String currentEmail) {
        Member member = findCurrentMember(currentEmail);
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("Post not found"));

        Comment comment = Comment.builder()
                .post(post)
                .member(member)
                .content(request.getContent())
                .isHidden("N")
                .build();

        Comment saved = commentRepository.save(comment);
        return toCommentResponse(saved, member.getMemberId(), isAdmin(member));
    }

    @Transactional
    public void deleteComment(Long commentId, String currentEmail) {
        Member member = findCurrentMember(currentEmail);
        Comment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new IllegalArgumentException("Comment not found"));

        Long ownerId = comment.getMember() != null ? comment.getMember().getMemberId() : null;
        boolean canDelete = isAdmin(member) || (ownerId != null && ownerId.equals(member.getMemberId()));
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
        if (!exists) {
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
                .createdAt(post.getCreatedAt())
                .updatedAt(post.getUpdatedAt())
                .canEdit(canEdit)
                .canDelete(canEdit)
                .build();
    }

    private CommentResponseDto toCommentResponse(Comment comment, Long currentMemberId, boolean isAdmin) {
        Long ownerId = comment.getMember() != null ? comment.getMember().getMemberId() : null;
        boolean canDelete = isAdmin || (ownerId != null && ownerId.equals(currentMemberId));

        String authorName = resolveDisplayName(comment.getMember());

        return CommentResponseDto.builder()
                .commentId(comment.getCommentId())
                .memberId(ownerId)
                .authorName(authorName)
                .content(comment.getContent())
                .createdAt(comment.getCreatedAt())
                .canDelete(canDelete)
                .build();
    }

    private boolean canManagePost(Post post, Member member) {
        if (isAdmin(member)) {
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
        return member.getRole() == Member.Role.ADMIN;
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
}
