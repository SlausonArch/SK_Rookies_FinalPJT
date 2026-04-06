package com.rookies.sk.controller;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

@RestController
@RequestMapping("/api/dev")
@ConditionalOnProperty(prefix = "app.api-docs", name = "enabled", havingValue = "true")
public class ApiDocsController {

    @org.springframework.beans.factory.annotation.Value("${app.api-docs.path:docs/api_spec.md}")
    private String apiDocsPath;

    @GetMapping(value = "/api-docs", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> getApiDocs() throws IOException {
        String markdown = Files.readString(Path.of(apiDocsPath), StandardCharsets.UTF_8);
        return ResponseEntity.ok(markdown);
    }
}

