package com.rookies.sk.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleResponseStatusException(ResponseStatusException ex) {
        String message = ex.getReason() != null ? ex.getReason() : "REQUEST_FAILED";
        return ResponseEntity.status(ex.getStatusCode()).body(Map.of("message", message));
    }

    // 필드 유효성 검증 실패 — 구체적인 필드명/메시지 노출 금지
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidationException(MethodArgumentNotValidException ex) {
        log.debug("Validation failed: {}", ex.getBindingResult().getAllErrors());
        return ResponseEntity.badRequest().body(Map.of("message", "잘못된 요청입니다."));
    }

    // JSON 파싱 오류 — 요청값(amount, title 등) 노출 방지
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, String>> handleMessageNotReadable(HttpMessageNotReadableException ex) {
        log.debug("Message not readable: {}", ex.getMessage());
        return ResponseEntity.badRequest().body(Map.of("message", "잘못된 요청입니다."));
    }

    // 경로 변수·쿼리 파라미터 타입 불일치 — 실제 값 노출 방지
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Map<String, String>> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        log.debug("Type mismatch for parameter '{}': {}", ex.getName(), ex.getMessage());
        return ResponseEntity.badRequest().body(Map.of("message", "잘못된 요청입니다."));
    }

    // 내부 RuntimeException — 메시지 내용 노출 금지
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, String>> handleRuntimeException(RuntimeException ex) {
        log.error("RuntimeException: {}", ex.getMessage(), ex);
        return ResponseEntity.badRequest().body(Map.of("message", "잘못된 요청입니다."));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleException(Exception ex) {
        log.error("Unhandled exception: {}", ex.getMessage(), ex);
        return ResponseEntity.status(500).body(Map.of("message", "서버 내부 오류가 발생했습니다."));
    }
}
