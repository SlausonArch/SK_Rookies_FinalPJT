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

        @Transactional
        public AssetResponseDto deposit(String email, DepositRequestDto req) {
                Member member = findMemberByEmail(email);
                validateTradePermission(member);
                String assetType = req.getAssetType().toUpperCase();
                Asset asset = findOrCreateAsset(member, assetType);

                asset.setBalance(asset.getBalance().add(req.getAmount()));
                assetRepository.save(asset);

                Transaction tx = Transaction.builder()
                                .member(member)
                                .txType("DEPOSIT")
                                .assetType(assetType)
                                .amount(req.getAmount())
                                .totalValue(req.getAmount())
                                .build();
                transactionRepository.save(tx);

                return toDto(asset);
        }

        @Transactional
        public AssetResponseDto withdraw(String email, DepositRequestDto req) {
                Member member = findMemberByEmail(email);
                validateTradePermission(member);
                String assetType = req.getAssetType().toUpperCase();
                Asset asset = assetRepository.findWithLockByMember_MemberIdAndAssetType(member.getMemberId(), assetType)
                                .orElseThrow(() -> new RuntimeException("자산이 없습니다."));

                BigDecimal available = asset.getBalance().subtract(asset.getLockedBalance());
                if (available.compareTo(req.getAmount()) < 0) {
                        throw new RuntimeException("출금 가능 잔고가 부족합니다.");
                }

                asset.setBalance(asset.getBalance().subtract(req.getAmount()));
                assetRepository.save(asset);

                Transaction tx = Transaction.builder()
                                .member(member)
                                .txType("WITHDRAW")
                                .assetType(assetType)
                                .amount(req.getAmount())
                                .totalValue(req.getAmount())
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

        private void validateTradePermission(Member member) {
                if (member.getStatus() == Member.Status.LOCKED) {
                        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "LOCKED_ACCOUNT");
                }
                if (member.getStatus() == Member.Status.WITHDRAWN) {
                        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "RESTRICTED_ACCOUNT");
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
