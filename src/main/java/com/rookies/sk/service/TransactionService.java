package com.rookies.sk.service;

import com.rookies.sk.dto.TransactionResponseDto;
import com.rookies.sk.entity.Member;
import com.rookies.sk.entity.Transaction;
import com.rookies.sk.repository.MemberRepository;
import com.rookies.sk.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TransactionService {

        private final TransactionRepository transactionRepository;
        private final MemberRepository memberRepository;

        @Transactional(readOnly = true)
        public List<TransactionResponseDto> getTransactions(String email) {
                Member member = memberRepository.findByEmail(email)
                                .orElseThrow(() -> new RuntimeException("회원을 찾을 수 없습니다."));
                return transactionRepository.findByMember_MemberIdOrderByTxDateDesc(member.getMemberId())
                                .stream()
                                .map(this::toDto)
                                .collect(Collectors.toList());
        }

        @Transactional(readOnly = true)
        public List<TransactionResponseDto> getTransactionsByAsset(String email, String assetType) {
                Member member = memberRepository.findByEmail(email)
                                .orElseThrow(() -> new RuntimeException("회원을 찾을 수 없습니다."));
                return transactionRepository.findByMember_MemberIdAndAssetTypeOrderByTxDateDesc(
                                member.getMemberId(), assetType.toUpperCase())
                                .stream()
                                .map(this::toDto)
                                .collect(Collectors.toList());
        }

        private TransactionResponseDto toDto(Transaction tx) {
                return TransactionResponseDto.builder()
                                .txId(tx.getTxId())
                                .txType(tx.getTxType())
                                .assetType(tx.getAssetType())
                                .amount(tx.getAmount())
                                .price(tx.getPrice())
                                .totalValue(tx.getTotalValue())
                                .fee(tx.getFee())
                                .txDate(tx.getTxDate())
                                .fromAddress(tx.getFromAddress())
                                .toAddress(tx.getToAddress())
                                .txHash(tx.getTxHash())
                                .bankName(tx.getBankName())
                                .accountNumber(tx.getAccountNumber())
                                .status(tx.getStatus())
                                .build();
        }
}
