package com.rookies.sk.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class SignupRequestDto {
    @NotBlank(message = "이름을 입력해 주세요.")
    @Size(min = 2, max = 50, message = "이름은 2~50자 이내로 입력해 주세요.")
    private String name;

    @NotBlank(message = "주민등록번호 앞자리를 입력해 주세요.")
    @Pattern(regexp = "\\d{6}[1-4]", message = "주민등록번호 형식이 올바르지 않습니다.")
    private String rrnPrefix;

    @NotBlank(message = "전화번호를 입력해 주세요.")
    @Pattern(regexp = "^01[0-9]-?\\d{3,4}-?\\d{4}$", message = "전화번호 형식이 올바르지 않습니다.")
    private String phoneNumber;

    @Size(max = 200, message = "주소는 200자 이내로 입력해 주세요.")
    private String address;

    @Size(max = 30, message = "은행명은 30자 이내로 입력해 주세요.")
    private String bankName;

    @Size(max = 50, message = "계좌번호는 50자 이내로 입력해 주세요.")
    private String accountNumber;

    @Size(max = 20, message = "추천인 코드는 20자 이내로 입력해 주세요.")
    private String referredByCode;
}
