package com.rookies.sk.service;

import com.rookies.sk.dto.AssetResponseDto;
import com.rookies.sk.dto.DepositRequestDto;
import com.rookies.sk.entity.Asset;
import com.rookies.sk.entity.Member;
import com.rookies.sk.entity.Transaction;
import com.rookies.sk.repository.AssetRepository;
import com.rookies.sk.repository.MemberRepository;
import com.rookies.sk.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
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
        Asset asset = assetRepository.findByMember_MemberIdAndAssetType(member.getMemberId(), assetType.toUpperCase())
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

    private Member findMemberByEmail(String email) {
        return memberRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("회원을 찾을 수 없습니다."));
    }

    private AssetResponseDto toDto(Asset asset) {
        return AssetResponseDto.builder()
                .assetId(asset.getAssetId())
                .assetType(asset.getAssetType())
                .balance(asset.getBalance())
                .lockedBalance(asset.getLockedBalance())
                .availableBalance(asset.getBalance().subtract(asset.getLockedBalance()))
                .build();
    }
}
