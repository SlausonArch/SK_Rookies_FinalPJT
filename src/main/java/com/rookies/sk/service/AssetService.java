package com.rookies.sk.service;

import com.rookies.sk.dto.AssetResponseDto;
import com.rookies.sk.dto.AssetSummaryDto;
import com.rookies.sk.dto.DepositRequestDto;
import com.rookies.sk.entity.Asset;
import com.rookies.sk.entity.Member;
import com.rookies.sk.entity.Transaction;
import com.rookies.sk.repository.AssetRepository;
import com.rookies.sk.repository.MemberRepository;
import com.rookies.sk.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AssetService {

        private final AssetRepository assetRepository;
        private final MemberRepository memberRepository;
        private final TransactionRepository transactionRepository;

        @Transactional(readOnly = true)
        public List<AssetResponseDto> getAssets(String email) {
                Member member = findMemberByEmail(email);
                return assetRepository.findByMember_MemberId(member.getMemberId())
                                .stream()
                                .map(this::toDto)
                                .collect(Collectors.toList());
        }

        @Transactional(readOnly = true)
        public AssetResponseDto getAsset(String email, String assetType) {
                Member member = findMemberByEmail(email);
                Asset asset = assetRepository
                                .findByMember_MemberIdAndAssetType(member.getMemberId(), assetType.toUpperCase())
                                .orElse(null);
                if (asset == null) {
                        return AssetResponseDto.builder()
                                        .assetType(assetType.toUpperCase())
                                        .balance(BigDecimal.ZERO)
                                        .lockedBalance(BigDecimal.ZERO)
                                        .availableBalance(BigDecimal.ZERO)
                                        .build();
                }
                return toDto(asset);
        }

        @Transactional(readOnly = true)
        public java.math.BigDecimal getBankBalance(String email) {
                return findMemberByEmail(email).getBankBalance();
        }

        @Transactional
        public AssetResponseDto deposit(String email, DepositRequestDto req) {
                Member member = findMemberByEmail(email);
                validateTradePermission(member);
                validateBankAccount(member, req.getBankName(), req.getAccountNumber());

                if (req.getAmount() == null || req.getAmount().compareTo(java.math.BigDecimal.ZERO) <= 0) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "입금 금액은 0보다 커야 합니다.");
                }

                String assetType = "KRW";
                Asset asset = findOrCreateAsset(member, assetType);

                // 검증을 save 전에 모두 완료
                java.math.BigDecimal newBankBalance = member.getBankBalance().subtract(req.getAmount());
                if (newBankBalance.compareTo(java.math.BigDecimal.ZERO) < 0) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "가상은행 잔고가 부족합니다.");
                }
                java.math.BigDecimal newAssetBalance = asset.getBalance().add(req.getAmount());
                if (newAssetBalance.compareTo(java.math.BigDecimal.ZERO) < 0) {
                        throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "잔고 계산 오류가 발생했습니다.");
                }

                // 검증 완료 후 일괄 저장
                member.setBankBalance(newBankBalance);
                memberRepository.save(member);
                asset.setBalance(newAssetBalance);
                assetRepository.save(asset);

                Transaction tx = Transaction.builder()
                                .member(member)
                                .txType("DEPOSIT")
                                .assetType(assetType)
                                .amount(req.getAmount())
                                .totalValue(req.getAmount())
                                .bankName(member.getBankName())
                                .accountNumber(member.getAccountNumber())
                                .build();
                transactionRepository.save(tx);

                return toDto(asset);
        }

        @Transactional
        public AssetResponseDto withdraw(String email, DepositRequestDto req) {
                Member member = findMemberByEmail(email);
                validateTradePermission(member);
                validateBankAccount(member, req.getBankName(), req.getAccountNumber());

                if (req.getAmount() == null || req.getAmount().compareTo(java.math.BigDecimal.ZERO) <= 0) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "출금 금액은 0보다 커야 합니다.");
                }

                String assetType = "KRW";
                Asset asset = assetRepository.findWithLockByMember_MemberIdAndAssetType(member.getMemberId(), assetType)
                                .orElseThrow(() -> new RuntimeException("자산이 없습니다."));

                BigDecimal available = asset.getBalance().subtract(asset.getLockedBalance());
                if (available.compareTo(req.getAmount()) < 0) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "출금 가능 잔고가 부족합니다.");
                }

                // 검증을 save 전에 모두 완료
                BigDecimal newAssetBalance = asset.getBalance().subtract(req.getAmount());
                if (newAssetBalance.compareTo(BigDecimal.ZERO) < 0) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "출금 가능 잔고가 부족합니다.");
                }
                BigDecimal newBankBalance = member.getBankBalance().add(req.getAmount());
                if (newBankBalance.compareTo(BigDecimal.ZERO) < 0) {
                        throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "잔고 계산 오류가 발생했습니다.");
                }

                // 검증 완료 후 일괄 저장
                asset.setBalance(newAssetBalance);
                assetRepository.save(asset);
                member.setBankBalance(newBankBalance);
                memberRepository.save(member);

                Transaction tx = Transaction.builder()
                                .member(member)
                                .txType("WITHDRAW")
                                .assetType(assetType)
                                .amount(req.getAmount())
                                .totalValue(req.getAmount())
                                .bankName(member.getBankName())
                                .accountNumber(member.getAccountNumber())
                                .build();
                transactionRepository.save(tx);

                return toDto(asset);
        }

        public Asset findOrCreateAsset(Member member, String assetType) {
                return assetRepository.findByMember_MemberIdAndAssetType(member.getMemberId(), assetType)
                                .orElseGet(() -> {
                                        Asset newAsset = Asset.builder()
                                                        .member(member)
                                                        .assetType(assetType)
                                                        .balance(BigDecimal.ZERO)
                                                        .lockedBalance(BigDecimal.ZERO)
                                                        .build();
                                        return assetRepository.save(newAsset);
                                });
        }

        @Transactional(readOnly = true)
        public AssetSummaryDto getAssetSummary(String email) {
                Member member = findMemberByEmail(email);

                // 총 투자원금 계산 (KRW DEPOSIT - KRW WITHDRAW만 합산, 코인 입출금 제외)
                List<Transaction> depositTxs = transactionRepository.findByMember_MemberIdAndTxTypeAndAssetType(
                                member.getMemberId(), "DEPOSIT", "KRW");
                List<Transaction> withdrawTxs = transactionRepository.findByMember_MemberIdAndTxTypeAndAssetType(
                                member.getMemberId(), "WITHDRAW", "KRW");

                BigDecimal totalDeposit = depositTxs.stream()
                                .map(Transaction::getAmount)
                                .reduce(BigDecimal.ZERO, BigDecimal::add);
                BigDecimal totalWithdraw = withdrawTxs.stream()
                                .map(Transaction::getAmount)
                                .reduce(BigDecimal.ZERO, BigDecimal::add);
                BigDecimal totalInvestment = totalDeposit.subtract(totalWithdraw);

                // KRW 잔고
                Asset krwAsset = assetRepository.findByMember_MemberIdAndAssetType(
                                member.getMemberId(), "KRW").orElse(null);
                BigDecimal krwBalance = krwAsset != null ? krwAsset.getBalance() : BigDecimal.ZERO;

                // 총 자산 가치 (일단 KRW만, 코인은 프론트엔드에서 계산)
                BigDecimal totalAssetValue = krwBalance;

                // 손익 및 수익률
                BigDecimal profitLoss = totalAssetValue.subtract(totalInvestment);
                BigDecimal profitRate = BigDecimal.ZERO;
                if (totalInvestment.compareTo(BigDecimal.ZERO) > 0) {
                        profitRate = profitLoss.divide(totalInvestment, 4, RoundingMode.HALF_UP)
                                        .multiply(new BigDecimal("100"));
                }

                return AssetSummaryDto.builder()
                                .krwBalance(krwBalance)
                                .totalInvestment(totalInvestment)
                                .totalAssetValue(totalAssetValue)
                                .profitLoss(profitLoss)
                                .profitRate(profitRate)
                                .build();
        }

        private Member findMemberByEmail(String email) {
                return memberRepository.findByEmail(email)
                                .orElseThrow(() -> new RuntimeException("회원을 찾을 수 없습니다."));
        }

        private void validateBankAccount(Member member, String bankName, String accountNumber) {
                String registeredBank = member.getBankName();
                String registeredAccount = member.getAccountNumber();
                if (registeredBank == null || registeredAccount == null) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "등록된 계좌 정보가 없습니다. 마이페이지에서 계좌를 등록해 주세요.");
                }
                if (!registeredBank.equals(bankName) || !registeredAccount.equals(accountNumber)) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "입력한 계좌 정보가 등록된 계좌와 일치하지 않습니다.");
                }
        }

        private void validateTradePermission(Member member) {
                if (member.getStatus() == Member.Status.LOCKED) {
                        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "RESTRICTED_ACCOUNT");
                }
                if (member.getStatus() == Member.Status.WITHDRAWN) {
                        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "WITHDRAWN_ACCOUNT");
                }
        }

        private AssetResponseDto toDto(Asset asset) {
                return AssetResponseDto.builder()
                                .assetId(asset.getAssetId())
                                .assetType(asset.getAssetType())
                                .balance(asset.getBalance())
                                .lockedBalance(asset.getLockedBalance())
                                .availableBalance(asset.getBalance().subtract(asset.getLockedBalance()))
                                .averageBuyPrice(asset.getAverageBuyPrice() != null ? asset.getAverageBuyPrice()
                                                : BigDecimal.ZERO)
                                .build();
        }
}
