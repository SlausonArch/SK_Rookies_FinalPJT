package com.rookies.sk.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class TokenRevokeRequestDto {
    private String refreshToken;
}
