package com.rookies.sk.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "FAQS")
public class Faq {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "FAQ_ID")
    private Long faqId;

    @Column(name = "CATEGORY", nullable = false)
    private String category;

    @Column(name = "QUESTION", nullable = false, length = 500)
    private String question;

    @Lob
    @Column(name = "ANSWER", nullable = false)
    private String answer;
}
