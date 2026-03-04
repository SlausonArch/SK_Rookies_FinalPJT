package com.rookies.sk.service;

import com.rookies.sk.entity.Asset;
import com.rookies.sk.entity.Member;
import com.rookies.sk.entity.Transaction;
import com.rookies.sk.entity.Wallet;
import com.rookies.sk.repository.AssetRepository;
import com.rookies.sk.repository.MemberRepository;
import com.rookies.sk.repository.TransactionRepository;
import com.rookies.sk.repository.WalletRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class WalletService {

    private final WalletRepository walletRepository;
    private final MemberRepository memberRepository;
    private final AssetRepository assetRepository;
    private final TransactionRepository transactionRepository;

    /**
     * 특정 코인에 대한 유저의 지갑(입금 주소)을 반환하거나, 없으면 새로 생성합니다.
     */
    @Transactional
    public String getOrCreateDepositAddress(String email, String assetType) {
        Member member = findMemberByEmail(email);

        Optional<Wallet> walletOpt = walletRepository.findByMember_MemberIdAndAssetType(member.getMemberId(),
                assetType.toUpperCase());
        if (walletOpt.isPresent()) {
            return walletOpt.get().getDepositAddress();
        }

        // 새로 생성 (실제 구현에서는 노드 연동이지만, 가상 지갑이므로 해시/UUID 사용)
        String newAddress = "VCE-" + UUID.randomUUID().toString().replace("-", "").substring(0, 30);

        Wallet wallet = Wallet.builder()
                .member(member)
                .assetType(assetType.toUpperCase())
                .depositAddress(newAddress)
                .build();

        walletRepository.save(wallet);
        return newAddress;
    }

    /**
     * 시스템 내부 지갑 주소 간 이체를 수행합니다.
     */
    @Transactional
    public void internalTransfer(String senderEmail, String assetType, String toAddress, BigDecimal amount,
            BigDecimal currentPrice) {
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("출금 수량은 0보다 커야 합니다.");
        }

        Member sender = findMemberByEmail(senderEmail);
        String assetUpper = assetType.toUpperCase();

        // 수신자 지갑 확인
        Wallet recipientWallet = walletRepository.findByDepositAddress(toAddress)
                .orElseThrow(() -> new IllegalArgumentException("유효하지 않은 지갑 주소입니다."));

        if (!recipientWallet.getAssetType().equals(assetUpper)) {
            throw new IllegalArgumentException("지원하지 않는 자산 타입의 지갑입니다.");
        }

        Member recipient = recipientWallet.getMember();
        if (sender.getMemberId().equals(recipient.getMemberId())) {
            throw new IllegalArgumentException("본인에게는 이체할 수 없습니다.");
        }

        // 송금자 잔고 확인 및 차감
        Asset senderAsset = assetRepository.findWithLockByMember_MemberIdAndAssetType(sender.getMemberId(), assetUpper)
                .orElseThrow(() -> new IllegalArgumentException("보유 자산이 없습니다."));

        BigDecimal available = senderAsset.getBalance().subtract(senderAsset.getLockedBalance());
        if (available.compareTo(amount) < 0) {
            throw new IllegalArgumentException("출금 가능 잔고가 부족합니다.");
        }

        senderAsset.setBalance(senderAsset.getBalance().subtract(amount));
        assetRepository.save(senderAsset);

        // 수신자 잔고 및 평단가 추가
        Asset recipientAsset = assetRepository.findByMember_MemberIdAndAssetType(recipient.getMemberId(), assetUpper)
                .orElseGet(() -> {
                    Asset newAsset = Asset.builder()
                            .member(recipient)
                            .assetType(assetUpper)
                            .balance(BigDecimal.ZERO)
                            .lockedBalance(BigDecimal.ZERO)
                            .averageBuyPrice(BigDecimal.ZERO)
                            .build();
                    return assetRepository.save(newAsset);
                });

        BigDecimal oldBalance = recipientAsset.getBalance() != null ? recipientAsset.getBalance() : BigDecimal.ZERO;
        BigDecimal oldAvgPrice = recipientAsset.getAverageBuyPrice() != null ? recipientAsset.getAverageBuyPrice()
                : BigDecimal.ZERO;
        BigDecimal newBalance = oldBalance.add(amount);
        BigDecimal marketPrice = currentPrice != null && currentPrice.compareTo(BigDecimal.ZERO) > 0 ? currentPrice
                : BigDecimal.ZERO;

        // 새로운 평단가 계산: ((기존 잔고 * 기존 평단가) + (입금 수량 * 현재 시세)) / 새로운 잔고
        // 이렇게 하면 입금 시점의 평가손익이 0이 되어, 코인 이체로 인한 인위적인 수익률 왜곡이 발생하지 않습니다.
        BigDecimal newAvgPrice = BigDecimal.ZERO;
        if (newBalance.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal totalOldValue = oldBalance.multiply(oldAvgPrice);
            BigDecimal transferValue = amount.multiply(marketPrice);
            newAvgPrice = totalOldValue.add(transferValue).divide(newBalance, 4, java.math.RoundingMode.HALF_UP);
        }

        recipientAsset.setBalance(newBalance);
        recipientAsset.setAverageBuyPrice(newAvgPrice);
        assetRepository.save(recipientAsset);

        // 송금자 출금 기록
        Transaction withdrawTx = Transaction.builder()
                .member(sender)
                .txType("WITHDRAW")
                .assetType(assetUpper)
                .amount(amount)
                .totalValue(amount)
                .build();
        transactionRepository.save(withdrawTx);

        // 수신자 입금 기록
        Transaction depositTx = Transaction.builder()
                .member(recipient)
                .txType("DEPOSIT")
                .assetType(assetUpper)
                .amount(amount)
                .totalValue(amount)
                .build();
        transactionRepository.save(depositTx);
    }

    private Member findMemberByEmail(String email) {
        return memberRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("회원을 찾을 수 없습니다."));
    }
}
