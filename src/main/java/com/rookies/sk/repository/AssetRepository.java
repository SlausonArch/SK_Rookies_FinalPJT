package com.rookies.sk.repository;

import com.rookies.sk.entity.Asset;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import java.util.List;
import java.util.Optional;

public interface AssetRepository extends JpaRepository<Asset, Long> {

    List<Asset> findByMember_MemberId(Long memberId);

    Optional<Asset> findByMember_MemberIdAndAssetType(Long memberId, String assetType);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<Asset> findWithLockByMember_MemberIdAndAssetType(Long memberId, String assetType);
}
