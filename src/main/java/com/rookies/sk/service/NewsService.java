package com.rookies.sk.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Slf4j
@Service
public class NewsService {

    private static final String GOOGLE_NEWS_RSS =
            "https://news.google.com/rss/search?q=%EB%B9%84%ED%8A%B8%EC%BD%94%EC%9D%B8+%EA%B0%80%EC%83%81%ED%99%94%ED%8F%90&hl=ko&gl=KR&ceid=KR:ko";

    private static final long CACHE_TTL_MS = 10 * 60 * 1000; // 10분 캐시

    private List<Map<String, String>> cachedNews = Collections.emptyList();
    private long lastFetchTime = 0;

    public List<Map<String, String>> getLatestNews() {
        long now = System.currentTimeMillis();
        if (now - lastFetchTime < CACHE_TTL_MS && !cachedNews.isEmpty()) {
            return cachedNews;
        }

        try {
            List<Map<String, String>> news = fetchRss(GOOGLE_NEWS_RSS);
            cachedNews = news;
            lastFetchTime = now;
            return news;
        } catch (Exception e) {
            log.error("RSS 피드 가져오기 실패: {}", e.getMessage());
            return cachedNews; // 실패 시 캐시 반환
        }
    }

    private List<Map<String, String>> fetchRss(String rssUrl) throws Exception {
        URL url = URI.create(rssUrl).toURL();
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("GET");
        conn.setRequestProperty("User-Agent", "Mozilla/5.0");
        conn.setConnectTimeout(5000);
        conn.setReadTimeout(5000);

        List<Map<String, String>> result = new ArrayList<>();

        try (InputStream is = conn.getInputStream()) {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            DocumentBuilder builder = factory.newDocumentBuilder();
            Document doc = builder.parse(is);

            NodeList items = doc.getElementsByTagName("item");
            int count = Math.min(items.getLength(), 20);

            for (int i = 0; i < count; i++) {
                Element item = (Element) items.item(i);
                Map<String, String> news = new LinkedHashMap<>();
                news.put("title", getTagValue(item, "title"));
                news.put("link", getTagValue(item, "link"));
                news.put("source", getTagValue(item, "source"));
                news.put("pubDate", formatPubDate(getTagValue(item, "pubDate")));
                result.add(news);
            }
        } finally {
            conn.disconnect();
        }

        return result;
    }

    private String getTagValue(Element parent, String tagName) {
        NodeList nodes = parent.getElementsByTagName(tagName);
        if (nodes.getLength() > 0 && nodes.item(0).getTextContent() != null) {
            return nodes.item(0).getTextContent().trim();
        }
        return "";
    }

    private String formatPubDate(String pubDate) {
        if (pubDate == null || pubDate.isEmpty()) return "";
        try {
            ZonedDateTime zdt = ZonedDateTime.parse(pubDate, DateTimeFormatter.RFC_1123_DATE_TIME);
            return zdt.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"));
        } catch (Exception e) {
            return pubDate;
        }
    }
}
