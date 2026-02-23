package com.rookies.sk.repository;

import com.rookies.sk.entity.Order;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OrderRepository extends JpaRepository<Order, Long> {

    List<Order> findByMember_MemberIdOrderByCreatedAtDesc(Long memberId);

    List<Order> findByMember_MemberIdAndStatusOrderByCreatedAtDesc(Long memberId, String status);
}
