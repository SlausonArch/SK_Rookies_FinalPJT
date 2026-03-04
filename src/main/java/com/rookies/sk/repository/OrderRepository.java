package com.rookies.sk.repository;

import com.rookies.sk.entity.Order;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface OrderRepository extends JpaRepository<Order, Long> {

    List<Order> findByMember_MemberIdOrderByCreatedAtDesc(Long memberId);

    List<Order> findByMember_MemberIdAndStatusOrderByCreatedAtDesc(Long memberId, String status);

    List<Order> findByMember_MemberIdAndStatusInOrderByCreatedAtDesc(Long memberId, List<String> statuses);

    List<Order> findByPriceTypeAndStatusInOrderByCreatedAtAsc(String priceType, List<String> statuses);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select o from Order o
            join fetch o.member
            where o.orderId = :orderId
            """)
    Optional<Order> findWithLockByOrderId(@Param("orderId") Long orderId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select o from Order o
            where o.assetType = :assetType
              and o.orderType = 'SELL'
              and o.priceType = 'LIMIT'
              and o.status in ('PENDING', 'PARTIAL')
              and o.price <= :buyLimitPrice
              and o.orderId <> :excludeOrderId
            order by o.price asc, o.createdAt asc
            """)
    List<Order> findMatchingSellOrdersForBuy(
            @Param("assetType") String assetType,
            @Param("buyLimitPrice") java.math.BigDecimal buyLimitPrice,
            @Param("excludeOrderId") Long excludeOrderId
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select o from Order o
            where o.assetType = :assetType
              and o.orderType = 'BUY'
              and o.priceType = 'LIMIT'
              and o.status in ('PENDING', 'PARTIAL')
              and o.price >= :sellLimitPrice
              and o.orderId <> :excludeOrderId
            order by o.price desc, o.createdAt asc
            """)
    List<Order> findMatchingBuyOrdersForSell(
            @Param("assetType") String assetType,
            @Param("sellLimitPrice") java.math.BigDecimal sellLimitPrice,
            @Param("excludeOrderId") Long excludeOrderId
    );
}
