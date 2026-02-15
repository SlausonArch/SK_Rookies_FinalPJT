package com.rookies.sk.dto;

import lombok.Data;

@Data
public class SignupRequestDto {
    private String name;
    private String rrnPrefix; // Resident Registration Number Prefix + 1 digit?
    // Actually the requirement said "RRN (Front + Back 1 digit)"
    // Let's assume frontend sends it as a string or separate fields.
    // Based on DB it's 'RRN_PREFIX'.
    private String phoneNumber;
    private String address;
    private String accountNumber;
    // File handled separately in controller as RequestPart
}
