package com.rookies.sk.repository;

import com.rookies.sk.entity.Transaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface TransactionRepository extends JpaRepository<Transaction, Long> {

    List<Transaction> findByMember_MemberIdOrderByTxDateDesc(Long memberId);

    List<Transaction> findByMember_MemberIdAndAssetTypeOrderByTxDateDesc(Long memberId, String assetType);

    List<Transaction> findByMember_MemberIdAndTxType(Long memberId, String txType);

    long countByMember_MemberIdAndTxTypeAndTxDateBetween(Long memberId, String txType, LocalDateTime from, LocalDateTime to);

    List<Transaction> findByMember_MemberIdAndTxTypeAndAssetType(Long memberId, String txType, String assetType);

    @org.springframework.data.jpa.repository.Query("SELECT COALESCE(SUM(t.totalValue), 0) FROM Transaction t WHERE t.member.memberId = :memberId AND t.txType IN ('BUY', 'SELL')")
    java.math.BigDecimal sumTotalVolumeByMemberId(
            @org.springframework.data.repository.query.Param("memberId") Long memberId);

    
    @Query("""
    select tx from Transaction tx
    where (:memberEmail is null or :memberEmail = '' 
           or lower(tx.member.email) like lower(concat('%', :memberEmail, '%')) escape '!')
      and (:assetType is null or :assetType = '' or tx.assetType = :assetType)
      and (:txType is null or :txType = '' or tx.txType = :txType)
      and (:from is null or tx.txDate >= :from)
      and (:to is null or tx.txDate <= :to)
    """)
    Page<Transaction> searchAdminTransactions(
            @Param("memberEmail") String memberEmail,
            @Param("assetType") String assetType,
            @Param("txType") String txType,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to,
            Pageable pageable
    );
}
