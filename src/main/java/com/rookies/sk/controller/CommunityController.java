package com.rookies.sk.controller;

import com.rookies.sk.dto.*;
import com.rookies.sk.entity.Member;
import com.rookies.sk.service.CommunityService;
import com.rookies.sk.service.FileService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import org.springframework.validation.annotation.Validated;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@Validated
@RestController
@RequestMapping("/api/community")
@RequiredArgsConstructor
public class CommunityController {

    private final CommunityService communityService;
    private final FileService fileService;

    @GetMapping("/posts")
    public ResponseEntity<List<PostResponseDto>> getPosts(
            @RequestParam(required = false) @Size(max = 100) String keyword,
            @AuthenticationPrincipal UserDetails userDetails) {
        String email = userDetails != null ? userDetails.getUsername() : null;
        return ResponseEntity.ok(communityService.getPosts(keyword, email));
    }

    @GetMapping("/posts/{postId}")
    public ResponseEntity<PostResponseDto> getPost(
            @PathVariable Long postId,
            @AuthenticationPrincipal UserDetails userDetails) {
        String email = userDetails != null ? userDetails.getUsername() : null;
        return ResponseEntity.ok(communityService.getPost(postId, email));
    }

    @PostMapping("/posts")
    public ResponseEntity<PostResponseDto> createPost(
            @Valid @RequestBody PostRequestDto request,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(communityService.createPost(request, userDetails.getUsername()));
    }

    @PatchMapping("/posts/{postId}")
    public ResponseEntity<PostResponseDto> updatePost(
            @PathVariable Long postId,
            @Valid @RequestBody PostRequestDto request,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(communityService.updatePost(postId, request, userDetails.getUsername()));
    }

    @PostMapping("/posts/{postId}/delete")
    public ResponseEntity<Void> deletePost(
            @PathVariable Long postId,
            @AuthenticationPrincipal UserDetails userDetails) {
        communityService.deletePost(postId, userDetails.getUsername());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/posts/{postId}/comments")
    public ResponseEntity<List<CommentResponseDto>> getComments(
            @PathVariable Long postId,
            @AuthenticationPrincipal UserDetails userDetails) {
        String email = userDetails != null ? userDetails.getUsername() : null;
        return ResponseEntity.ok(communityService.getComments(postId, email));
    }

    @PostMapping("/posts/{postId}/comments")
    public ResponseEntity<CommentResponseDto> addComment(
            @PathVariable Long postId,
            @Valid @RequestBody CommentRequestDto request,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(communityService.addComment(postId, request, userDetails.getUsername()));
    }

    @PatchMapping("/comments/{commentId}")
    public ResponseEntity<CommentResponseDto> updateComment(
            @PathVariable Long commentId,
            @Valid @RequestBody CommentRequestDto request,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(communityService.updateComment(commentId, request, userDetails.getUsername()));
    }

    @PostMapping("/comments/{commentId}/delete")
    public ResponseEntity<Void> deleteComment(
            @PathVariable Long commentId,
            @AuthenticationPrincipal UserDetails userDetails) {
        communityService.deleteComment(commentId, userDetails.getUsername());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/posts/{postId}/like")
    public ResponseEntity<Map<String, Long>> likePost(
            @PathVariable Long postId,
            @AuthenticationPrincipal UserDetails userDetails) {
        long likeCount = communityService.likePost(postId, userDetails.getUsername());
        return ResponseEntity.ok(Map.of("likeCount", likeCount));
    }

    @PostMapping(value = "/uploads", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> uploadAttachment(
            @RequestPart("file") MultipartFile file) {
        String path = fileService.storeFile(file);
        return ResponseEntity.ok(Map.of("attachmentUrl", path));
    }

    @PatchMapping("/admin/members/{memberId}/status")
    public ResponseEntity<Map<String, String>> updateMemberStatus(
            @PathVariable Long memberId,
            @RequestBody MemberStatusRequestDto request,
            @AuthenticationPrincipal UserDetails userDetails) {
        Member updated = communityService.updateMemberStatus(memberId, request, userDetails.getUsername());
        return ResponseEntity.ok(Map.of("status", updated.getStatus().name()));
    }
}
