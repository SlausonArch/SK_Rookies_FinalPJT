package com.rookies.sk.repository;

import com.rookies.sk.entity.Wallet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface WalletRepository extends JpaRepository<Wallet, Long> {
    Optional<Wallet> findByMember_MemberIdAndAssetType(Long memberId, String assetType);

    Optional<Wallet> findByDepositAddress(String depositAddress);
}
