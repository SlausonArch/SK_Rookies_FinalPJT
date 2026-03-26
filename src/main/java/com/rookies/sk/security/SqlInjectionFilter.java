package com.rookies.sk.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.regex.Pattern;

/**
 * URL 디코딩 이전의 raw 쿼리 스트링에서 SQL 인젝션 메타문자를 검사한다.
 * Spring의 파라미터 파싱 전에 실행되므로 불완전한 percent-encoding 우회를 차단한다.
 */
@Slf4j
@Component
public class SqlInjectionFilter extends OncePerRequestFilter {

    // 쿼리 스트링에 리터럴로 나타나면 안 되는 SQL 메타문자
    // 정상 요청이라면 '→%27, (→%28, )→%29, ;→%3B 로 인코딩되어야 한다.
    private static final Pattern SQL_META_RAW = Pattern.compile("['\";()]");

    // 검사 대상 엔드포인트 prefix
    private static final String[] PROTECTED_PATHS = {
        "/api/admin/members/search",
        "/api/admin/transactions/search"
    };

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain)
            throws ServletException, IOException {

        String uri = request.getRequestURI();
        if (isProtectedPath(uri)) {
            String rawQuery = request.getQueryString(); // URL 디코딩 전 raw 값
            if (rawQuery != null && SQL_META_RAW.matcher(rawQuery).find()) {
                log.warn("SQL injection attempt blocked on [{}]: query=[{}]",
                        uri, rawQuery.replaceAll("[\r\n]", " "));
                response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                response.setContentType("application/json;charset=UTF-8");
                response.getWriter().write("{\"message\":\"잘못된 요청입니다.\"}");
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    private boolean isProtectedPath(String uri) {
        for (String path : PROTECTED_PATHS) {
            if (uri.startsWith(path)) return true;
        }
        return false;
    }
}
