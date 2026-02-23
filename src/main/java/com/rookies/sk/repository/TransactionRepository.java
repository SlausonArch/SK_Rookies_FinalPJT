package com.rookies.sk.repository;

import com.rookies.sk.entity.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TransactionRepository extends JpaRepository<Transaction, Long> {

    List<Transaction> findByMember_MemberIdOrderByTxDateDesc(Long memberId);

    List<Transaction> findByMember_MemberIdAndAssetTypeOrderByTxDateDesc(Long memberId, String assetType);

    List<Transaction> findByMember_MemberIdAndTxType(Long memberId, String txType);

    List<Transaction> findByMember_MemberIdAndTxTypeAndAssetType(Long memberId, String txType, String assetType);

    @org.springframework.data.jpa.repository.Query("SELECT COALESCE(SUM(t.totalValue), 0) FROM Transaction t WHERE t.member.memberId = :memberId AND t.txType IN ('BUY', 'SELL')")
    java.math.BigDecimal sumTotalVolumeByMemberId(
            @org.springframework.data.repository.query.Param("memberId") Long memberId);
}
