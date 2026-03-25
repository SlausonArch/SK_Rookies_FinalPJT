package com.rookies.sk.service;

import com.rookies.sk.dto.OrderRequestDto;
import com.rookies.sk.dto.OrderResponseDto;
import com.rookies.sk.entity.Asset;
import com.rookies.sk.entity.Member;
import com.rookies.sk.entity.Order;
import com.rookies.sk.entity.Transaction;
import com.rookies.sk.repository.AssetRepository;
import com.rookies.sk.repository.MemberRepository;
import com.rookies.sk.repository.OrderRepository;
import com.rookies.sk.repository.TransactionRepository;

import java.util.Map;
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
public class OrderService {

    private static final int SCALE = 8;
    private static final BigDecimal TRADE_EPSILON = new BigDecimal("0.00000001");
    private static final BigDecimal MAX_FEE_RATE = new BigDecimal("0.0008");

    private final OrderRepository orderRepository;
    private final AssetRepository assetRepository;
    private final TransactionRepository transactionRepository;
    private final MemberRepository memberRepository;
    private final AssetService assetService;
    private final UpbitPriceService upbitPriceService;

    @Transactional
    public OrderResponseDto createOrder(String email, OrderRequestDto req) {
        Member member = memberRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "회원을 찾을 수 없습니다."));
        validateTradePermission(member);

        String assetType = normalize(req.getAssetType());
        String orderType = normalize(req.getOrderType());
        String priceType = normalize(req.getPriceType());
        if (priceType.isBlank()) {
            priceType = "LIMIT";
        }

        if (assetType.isBlank() || !assetType.matches("^[A-Z0-9]{2,10}$") || assetType.equals("KRW")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "유효하지 않은 자산 코드입니다.");
        }
        if (!"BUY".equals(orderType) && !"SELL".equals(orderType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "주문 유형은 BUY 또는 SELL이어야 합니다.");
        }
        if (!"LIMIT".equals(priceType) && !"MARKET".equals(priceType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "주문 방식은 LIMIT 또는 MARKET이어야 합니다.");
        }

        BigDecimal price = normalizePrice(req.getPrice());
        BigDecimal amount = normalizeAmount(req.getAmount());

        if (price.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "주문 가격은 0보다 커야 합니다.");
        }
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "주문 수량은 0보다 커야 합니다.");
        }

        if ("MARKET".equals(priceType)) {
            return executeMarketOrder(member, orderType, assetType, price, amount);
        }
        return executeLimitOrder(member, orderType, assetType, price, amount);
    }

    @Transactional
    public OrderResponseDto cancelOrder(String email, Long orderId) {
        Member member = memberRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "회원을 찾을 수 없습니다."));
        validateTradePermission(member);

        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "주문을 찾을 수 없습니다."));

        if (!order.getMember().getMemberId().equals(member.getMemberId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "본인의 주문만 취소할 수 있습니다.");
        }
        if (!"PENDING".equals(order.getStatus()) && !"PARTIAL".equals(order.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "대기 중인 주문만 취소할 수 있습니다.");
        }

        BigDecimal remainingAmount = remainingAmount(order);
        if (remainingAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "취소 가능한 미체결 수량이 없습니다.");
        }

        if ("BUY".equals(order.getOrderType())) {
            Asset krwAsset = assetRepository.findWithLockByMember_MemberIdAndAssetType(member.getMemberId(), "KRW")
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "KRW 자산을 찾을 수 없습니다."));
            BigDecimal reserveToRelease = reserveAmountForBuy(order.getPrice(), remainingAmount);
            krwAsset.setLockedBalance(nonNegative(krwAsset.getLockedBalance().subtract(reserveToRelease)));
            if (krwAsset.getLockedBalance().abs().compareTo(TRADE_EPSILON) <= 0) {
                krwAsset.setLockedBalance(BigDecimal.ZERO);
            }
            assetRepository.save(krwAsset);
        } else {
            Asset coinAsset = assetRepository.findWithLockByMember_MemberIdAndAssetType(member.getMemberId(), order.getAssetType())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "자산을 찾을 수 없습니다."));
            coinAsset.setLockedBalance(nonNegative(coinAsset.getLockedBalance().subtract(remainingAmount)));
            if (coinAsset.getLockedBalance().abs().compareTo(TRADE_EPSILON) <= 0) {
                coinAsset.setLockedBalance(BigDecimal.ZERO);
            }
            assetRepository.save(coinAsset);
        }

        order.setStatus("CANCELLED");
        orderRepository.save(order);

        return toDto(order);
    }

    @Transactional(readOnly = true)
    public List<OrderResponseDto> getOrders(String email) {
        Member member = memberRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "회원을 찾을 수 없습니다."));
        return orderRepository.findByMember_MemberIdOrderByCreatedAtDesc(member.getMemberId())
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<OrderResponseDto> getOpenOrders(String email) {
        Member member = memberRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "회원을 찾을 수 없습니다."));
        return orderRepository.findByMember_MemberIdAndStatusInOrderByCreatedAtDesc(
                        member.getMemberId(), List.of("PENDING", "PARTIAL"))
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public boolean tryExecuteExternalLimitFill(Long orderId, BigDecimal externalPrice) {
        if (externalPrice == null || externalPrice.compareTo(BigDecimal.ZERO) <= 0) {
            return false;
        }

        Order order = orderRepository.findWithLockByOrderId(orderId).orElse(null);
        if (order == null) {
            return false;
        }
        if (!"LIMIT".equals(order.getPriceType())) {
            return false;
        }
        if (!"PENDING".equals(order.getStatus()) && !"PARTIAL".equals(order.getStatus())) {
            return false;
        }

        BigDecimal marketPrice = normalizePrice(externalPrice);
        if (!isTriggeredByExternalPrice(order, marketPrice)) {
            return false;
        }

        BigDecimal fillAmount = remainingAmount(order);
        if (fillAmount.compareTo(BigDecimal.ZERO) <= 0) {
            order.setStatus("FILLED");
            orderRepository.save(order);
            return false;
        }

        BigDecimal executedAmount;
        if ("BUY".equals(order.getOrderType())) {
            executedAmount = executeExternalLimitBuy(order, marketPrice, fillAmount);
        } else if ("SELL".equals(order.getOrderType())) {
            executedAmount = executeExternalLimitSell(order, marketPrice, fillAmount);
        } else {
            return false;
        }
        if (executedAmount.compareTo(BigDecimal.ZERO) <= 0) {
            return false;
        }

        applyFill(order, executedAmount);
        orderRepository.save(order);
        return true;
    }

    private OrderResponseDto executeMarketOrder(
            Member member,
            String orderType,
            String assetType,
            BigDecimal price,
            BigDecimal amount
    ) {
        // 시장가 주문: 서버에서 Upbit 현재가 조회, 실패 시 클라이언트 전달 가격 사용
        Map<String, BigDecimal> currentPrices = upbitPriceService.fetchCurrentPrices(List.of(assetType));
        BigDecimal serverPrice = currentPrices.get(assetType.toUpperCase());
        if (serverPrice == null || serverPrice.compareTo(BigDecimal.ZERO) <= 0) {
            // Upbit 조회 실패 시 클라이언트 제공 가격으로 대체
            if (price != null && price.compareTo(BigDecimal.ZERO) > 0) {
                serverPrice = price;
            } else {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "현재가 조회에 실패했습니다. 잠시 후 다시 시도해 주세요.");
            }
        }

        BigDecimal feeRate = getMemberFeeRate(member);
        BigDecimal totalValue = totalValue(serverPrice, amount);
        BigDecimal fee = feeAmount(totalValue, feeRate);

        if ("BUY".equals(orderType)) {
            Asset krwAsset = assetRepository.findWithLockByMember_MemberIdAndAssetType(member.getMemberId(), "KRW")
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "KRW 잔고가 없습니다."));

            BigDecimal required = totalValue.add(fee);
            BigDecimal available = krwAsset.getBalance().subtract(krwAsset.getLockedBalance());
            if (available.compareTo(required) < 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "KRW 잔고가 부족합니다.");
            }

            krwAsset.setBalance(krwAsset.getBalance().subtract(required));
            assetRepository.save(krwAsset);

            Asset coinAsset = assetService.findOrCreateAsset(member, assetType);
            applyBuyFillToCoinAsset(coinAsset, amount, totalValue.add(fee));
            assetRepository.save(coinAsset);
        } else {
            Asset coinAsset = assetRepository.findWithLockByMember_MemberIdAndAssetType(member.getMemberId(), assetType)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "코인 잔고가 없습니다."));

            BigDecimal available = coinAsset.getBalance().subtract(coinAsset.getLockedBalance());
            if (available.compareTo(amount) < 0) {
                BigDecimal gap = amount.subtract(available);
                if (gap.compareTo(TRADE_EPSILON) <= 0) {
                    amount = available;
                    totalValue = totalValue(serverPrice, amount);
                    fee = feeAmount(totalValue, feeRate);
                } else {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "코인 잔고가 부족합니다.");
                }
            }

            coinAsset.setBalance(nonNegative(coinAsset.getBalance().subtract(amount)));
            if (coinAsset.getBalance().abs().compareTo(TRADE_EPSILON) <= 0) {
                coinAsset.setBalance(BigDecimal.ZERO);
            }
            assetRepository.save(coinAsset);

            Asset krwAsset = assetService.findOrCreateAsset(member, "KRW");
            krwAsset.setBalance(krwAsset.getBalance().add(totalValue.subtract(fee)));
            assetRepository.save(krwAsset);
        }

        Order order = Order.builder()
                .member(member)
                .orderType(orderType)
                .priceType("MARKET")
                .assetType(assetType)
                .price(serverPrice)
                .amount(amount)
                .filledAmount(amount)
                .status("FILLED")
                .build();
        orderRepository.save(order);

        saveTransaction(member, order, orderType, assetType, amount, serverPrice, totalValue, fee);
        return toDto(order);
    }

    private OrderResponseDto executeLimitOrder(
            Member member,
            String orderType,
            String assetType,
            BigDecimal price,
            BigDecimal requestedAmount
    ) {
        BigDecimal amount = requestedAmount;
        if ("BUY".equals(orderType)) {
            Asset krwAsset = assetRepository.findWithLockByMember_MemberIdAndAssetType(member.getMemberId(), "KRW")
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "KRW 잔고가 없습니다."));

            BigDecimal reserve = reserveAmountForBuy(price, amount);
            BigDecimal available = krwAsset.getBalance().subtract(krwAsset.getLockedBalance());
            if (available.compareTo(reserve) < 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "KRW 잔고가 부족합니다.");
            }
            krwAsset.setLockedBalance(krwAsset.getLockedBalance().add(reserve));
            assetRepository.save(krwAsset);
        } else {
            Asset coinAsset = assetRepository.findWithLockByMember_MemberIdAndAssetType(member.getMemberId(), assetType)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "코인 잔고가 없습니다."));
            BigDecimal available = coinAsset.getBalance().subtract(coinAsset.getLockedBalance());
            if (available.compareTo(amount) < 0) {
                BigDecimal gap = amount.subtract(available);
                if (gap.compareTo(TRADE_EPSILON) <= 0) {
                    amount = normalizeAmount(available);
                } else {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "코인 잔고가 부족합니다.");
                }
            }
            coinAsset.setLockedBalance(coinAsset.getLockedBalance().add(amount));
            assetRepository.save(coinAsset);
        }

        Order order = Order.builder()
                .member(member)
                .orderType(orderType)
                .priceType("LIMIT")
                .assetType(assetType)
                .price(price)
                .amount(amount)
                .filledAmount(BigDecimal.ZERO)
                .status("PENDING")
                .build();
        orderRepository.save(order);

        matchLimitOrder(order);
        orderRepository.save(order);
        return toDto(order);
    }

    private void matchLimitOrder(Order takerOrder) {
        if (!"LIMIT".equals(takerOrder.getPriceType())) {
            return;
        }

        List<Order> makers = "BUY".equals(takerOrder.getOrderType())
                ? orderRepository.findMatchingSellOrdersForBuy(takerOrder.getAssetType(), takerOrder.getPrice(), takerOrder.getOrderId())
                : orderRepository.findMatchingBuyOrdersForSell(takerOrder.getAssetType(), takerOrder.getPrice(), takerOrder.getOrderId());

        for (Order makerOrder : makers) {
            if (isClosed(takerOrder)) {
                break;
            }
            if (makerOrder.getMember().getMemberId().equals(takerOrder.getMember().getMemberId())) {
                continue;
            }
            if (isClosed(makerOrder)) {
                continue;
            }

            BigDecimal takerRemain = remainingAmount(takerOrder);
            BigDecimal makerRemain = remainingAmount(makerOrder);
            BigDecimal tradeAmount = normalizeAmount(takerRemain.min(makerRemain));
            if (tradeAmount.compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }

            BigDecimal tradePrice = normalizePrice(makerOrder.getPrice());
            executeLimitMatch(takerOrder, makerOrder, tradePrice, tradeAmount);

            orderRepository.save(makerOrder);
            orderRepository.save(takerOrder);
        }
    }

    private void executeLimitMatch(Order takerOrder, Order makerOrder, BigDecimal tradePrice, BigDecimal tradeAmount) {
        Order buyOrder = "BUY".equals(takerOrder.getOrderType()) ? takerOrder : makerOrder;
        Order sellOrder = "SELL".equals(takerOrder.getOrderType()) ? takerOrder : makerOrder;
        Member buyMember = buyOrder.getMember();
        Member sellMember = sellOrder.getMember();
        String assetType = buyOrder.getAssetType();

        BigDecimal tradeValue = totalValue(tradePrice, tradeAmount);
        BigDecimal buyFeeRate = getMemberFeeRate(buyMember);
        BigDecimal sellFeeRate = getMemberFeeRate(sellMember);
        BigDecimal buyFee = feeAmount(tradeValue, buyFeeRate);
        BigDecimal sellFee = feeAmount(tradeValue, sellFeeRate);

        Asset buyerKrw = assetRepository.findWithLockByMember_MemberIdAndAssetType(buyMember.getMemberId(), "KRW")
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "KRW 잔고가 없습니다."));
        BigDecimal reserveUsed = reserveAmountForBuy(buyOrder.getPrice(), tradeAmount);
        if (buyerKrw.getLockedBalance().compareTo(reserveUsed) < 0) {
            BigDecimal gap = reserveUsed.subtract(buyerKrw.getLockedBalance());
            if (gap.compareTo(TRADE_EPSILON) <= 0) {
                reserveUsed = buyerKrw.getLockedBalance();
            } else {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "매수 주문 잠금 잔고가 부족합니다.");
            }
        }

        buyerKrw.setBalance(nonNegative(buyerKrw.getBalance().subtract(reserveUsed)));
        buyerKrw.setLockedBalance(nonNegative(buyerKrw.getLockedBalance().subtract(reserveUsed)));
        BigDecimal buyerActualSpent = tradeValue.add(buyFee);
        BigDecimal refund = reserveUsed.subtract(buyerActualSpent);
        if (refund.compareTo(BigDecimal.ZERO) > 0) {
            buyerKrw.setBalance(buyerKrw.getBalance().add(refund));
        }
        if (buyerKrw.getLockedBalance().abs().compareTo(TRADE_EPSILON) <= 0) {
            buyerKrw.setLockedBalance(BigDecimal.ZERO);
        }
        assetRepository.save(buyerKrw);

        Asset buyerCoin = assetService.findOrCreateAsset(buyMember, assetType);
        applyBuyFillToCoinAsset(buyerCoin, tradeAmount, tradeValue.add(buyFee));
        assetRepository.save(buyerCoin);

        Asset sellerCoin = assetRepository.findWithLockByMember_MemberIdAndAssetType(sellMember.getMemberId(), assetType)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "코인 잔고가 없습니다."));
        sellerCoin.setLockedBalance(nonNegative(sellerCoin.getLockedBalance().subtract(tradeAmount)));
        sellerCoin.setBalance(nonNegative(sellerCoin.getBalance().subtract(tradeAmount)));
        if (sellerCoin.getLockedBalance().abs().compareTo(TRADE_EPSILON) <= 0) {
            sellerCoin.setLockedBalance(BigDecimal.ZERO);
        }
        if (sellerCoin.getBalance().abs().compareTo(TRADE_EPSILON) <= 0) {
            sellerCoin.setBalance(BigDecimal.ZERO);
        }
        assetRepository.save(sellerCoin);

        Asset sellerKrw = assetService.findOrCreateAsset(sellMember, "KRW");
        sellerKrw.setBalance(sellerKrw.getBalance().add(tradeValue.subtract(sellFee)));
        assetRepository.save(sellerKrw);

        applyFill(buyOrder, tradeAmount);
        applyFill(sellOrder, tradeAmount);

        saveTransaction(buyMember, buyOrder, "BUY", assetType, tradeAmount, tradePrice, tradeValue, buyFee);
        saveTransaction(sellMember, sellOrder, "SELL", assetType, tradeAmount, tradePrice, tradeValue, sellFee);
    }

    private void applyBuyFillToCoinAsset(Asset coinAsset, BigDecimal fillAmount, BigDecimal fillCostWithFee) {
        BigDecimal currentBalance = normalizeAmount(coinAsset.getBalance());
        BigDecimal currentAvg = coinAsset.getAverageBuyPrice() != null
                ? normalizePrice(coinAsset.getAverageBuyPrice())
                : BigDecimal.ZERO;

        if (currentBalance.compareTo(BigDecimal.ZERO) <= 0) {
            coinAsset.setAverageBuyPrice(
                    fillCostWithFee.divide(fillAmount, SCALE, RoundingMode.HALF_UP)
            );
        } else {
            BigDecimal currentTotalCost = totalValue(currentBalance, currentAvg);
            BigDecimal nextTotalCost = currentTotalCost.add(fillCostWithFee);
            BigDecimal nextBalance = currentBalance.add(fillAmount);
            coinAsset.setAverageBuyPrice(nextTotalCost.divide(nextBalance, SCALE, RoundingMode.HALF_UP));
        }
        coinAsset.setBalance(currentBalance.add(fillAmount));
    }

    private boolean isTriggeredByExternalPrice(Order order, BigDecimal marketPrice) {
        if ("BUY".equals(order.getOrderType())) {
            return marketPrice.compareTo(order.getPrice()) <= 0;
        }
        if ("SELL".equals(order.getOrderType())) {
            return marketPrice.compareTo(order.getPrice()) >= 0;
        }
        return false;
    }

    private BigDecimal executeExternalLimitBuy(Order buyOrder, BigDecimal tradePrice, BigDecimal tradeAmount) {
        Member buyer = buyOrder.getMember();
        String assetType = buyOrder.getAssetType();

        BigDecimal tradeValue = totalValue(tradePrice, tradeAmount);
        BigDecimal fee = feeAmount(tradeValue, getMemberFeeRate(buyer));

        Asset buyerKrw = assetRepository.findWithLockByMember_MemberIdAndAssetType(buyer.getMemberId(), "KRW")
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "KRW 잔고가 없습니다."));

        BigDecimal reserved = reserveAmountForBuy(buyOrder.getPrice(), tradeAmount);
        if (buyerKrw.getLockedBalance().compareTo(reserved) < 0) {
            BigDecimal gap = reserved.subtract(buyerKrw.getLockedBalance());
            if (gap.compareTo(TRADE_EPSILON) <= 0) {
                reserved = buyerKrw.getLockedBalance();
            } else {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "매수 주문 잠금 잔고가 부족합니다.");
            }
        }

        buyerKrw.setBalance(nonNegative(buyerKrw.getBalance().subtract(reserved)));
        buyerKrw.setLockedBalance(nonNegative(buyerKrw.getLockedBalance().subtract(reserved)));

        BigDecimal actualSpent = tradeValue.add(fee);
        BigDecimal refund = reserved.subtract(actualSpent);
        if (refund.compareTo(BigDecimal.ZERO) > 0) {
            buyerKrw.setBalance(buyerKrw.getBalance().add(refund));
        }
        if (buyerKrw.getLockedBalance().abs().compareTo(TRADE_EPSILON) <= 0) {
            buyerKrw.setLockedBalance(BigDecimal.ZERO);
        }
        assetRepository.save(buyerKrw);

        Asset buyerCoin = assetService.findOrCreateAsset(buyer, assetType);
        applyBuyFillToCoinAsset(buyerCoin, tradeAmount, tradeValue.add(fee));
        assetRepository.save(buyerCoin);

        saveTransaction(buyer, buyOrder, "BUY", assetType, tradeAmount, tradePrice, tradeValue, fee);
        return tradeAmount;
    }

    private BigDecimal executeExternalLimitSell(Order sellOrder, BigDecimal tradePrice, BigDecimal tradeAmount) {
        Member seller = sellOrder.getMember();
        String assetType = sellOrder.getAssetType();

        BigDecimal tradeValue = totalValue(tradePrice, tradeAmount);
        BigDecimal fee = feeAmount(tradeValue, getMemberFeeRate(seller));

        Asset sellerCoin = assetRepository.findWithLockByMember_MemberIdAndAssetType(seller.getMemberId(), assetType)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "코인 잔고가 없습니다."));

        if (sellerCoin.getLockedBalance().compareTo(tradeAmount) < 0) {
            BigDecimal gap = tradeAmount.subtract(sellerCoin.getLockedBalance());
            if (gap.compareTo(TRADE_EPSILON) <= 0) {
                tradeAmount = sellerCoin.getLockedBalance();
                tradeValue = totalValue(tradePrice, tradeAmount);
                fee = feeAmount(tradeValue, getMemberFeeRate(seller));
            } else {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "매도 주문 잠금 잔고가 부족합니다.");
            }
        }
        if (tradeAmount.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }

        sellerCoin.setLockedBalance(nonNegative(sellerCoin.getLockedBalance().subtract(tradeAmount)));
        sellerCoin.setBalance(nonNegative(sellerCoin.getBalance().subtract(tradeAmount)));
        if (sellerCoin.getLockedBalance().abs().compareTo(TRADE_EPSILON) <= 0) {
            sellerCoin.setLockedBalance(BigDecimal.ZERO);
        }
        if (sellerCoin.getBalance().abs().compareTo(TRADE_EPSILON) <= 0) {
            sellerCoin.setBalance(BigDecimal.ZERO);
        }
        assetRepository.save(sellerCoin);

        Asset sellerKrw = assetService.findOrCreateAsset(seller, "KRW");
        sellerKrw.setBalance(sellerKrw.getBalance().add(tradeValue.subtract(fee)));
        assetRepository.save(sellerKrw);

        saveTransaction(seller, sellOrder, "SELL", assetType, tradeAmount, tradePrice, tradeValue, fee);
        return tradeAmount;
    }

    private void applyFill(Order order, BigDecimal fillAmount) {
        BigDecimal nextFilled = normalizeAmount(order.getFilledAmount().add(fillAmount));
        BigDecimal amount = normalizeAmount(order.getAmount());
        if (amount.subtract(nextFilled).abs().compareTo(TRADE_EPSILON) <= 0 || nextFilled.compareTo(amount) >= 0) {
            order.setFilledAmount(amount);
            order.setStatus("FILLED");
            return;
        }
        order.setFilledAmount(nextFilled);
        if (nextFilled.compareTo(BigDecimal.ZERO) > 0) {
            order.setStatus("PARTIAL");
        } else {
            order.setStatus("PENDING");
        }
    }

    private boolean isClosed(Order order) {
        return "FILLED".equals(order.getStatus()) || "CANCELLED".equals(order.getStatus());
    }

    private BigDecimal remainingAmount(Order order) {
        BigDecimal remain = normalizeAmount(order.getAmount().subtract(order.getFilledAmount()));
        if (remain.abs().compareTo(TRADE_EPSILON) <= 0) {
            return BigDecimal.ZERO;
        }
        return remain;
    }

    private BigDecimal totalValue(BigDecimal price, BigDecimal amount) {
        return normalizePrice(price.multiply(amount));
    }

    private BigDecimal feeAmount(BigDecimal totalValue, BigDecimal feeRate) {
        return normalizePrice(totalValue.multiply(feeRate));
    }

    private BigDecimal reserveAmountForBuy(BigDecimal price, BigDecimal amount) {
        BigDecimal value = totalValue(price, amount);
        return value.add(feeAmount(value, MAX_FEE_RATE));
    }

    private BigDecimal normalizePrice(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value.setScale(SCALE, RoundingMode.HALF_UP);
    }

    private BigDecimal normalizeAmount(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value.setScale(SCALE, RoundingMode.DOWN);
    }

    private BigDecimal nonNegative(BigDecimal value) {
        if (value.compareTo(BigDecimal.ZERO) < 0 && value.abs().compareTo(TRADE_EPSILON) <= 0) {
            return BigDecimal.ZERO;
        }
        return value.max(BigDecimal.ZERO);
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toUpperCase();
    }

    private void saveTransaction(
            Member member,
            Order order,
            String txType,
            String assetType,
            BigDecimal amount,
            BigDecimal price,
            BigDecimal totalValue,
            BigDecimal fee
    ) {
        Transaction tx = Transaction.builder()
                .member(member)
                .order(order)
                .txType(txType)
                .assetType(assetType)
                .amount(amount)
                .price(price)
                .totalValue(totalValue)
                .fee(fee)
                .build();
        transactionRepository.save(tx);
    }

    private BigDecimal getMemberFeeRate(Member member) {
        BigDecimal totalVolume = transactionRepository.sumTotalVolumeByMemberId(member.getMemberId());
        if (totalVolume == null) {
            totalVolume = BigDecimal.ZERO;
        }

        if (totalVolume.compareTo(new BigDecimal("100000000")) < 0) {
            return new BigDecimal("0.0008"); // Bronze: 0.08%
        } else if (totalVolume.compareTo(new BigDecimal("2000000000")) < 0) {
            return new BigDecimal("0.0005"); // Silver: 0.05%
        } else if (totalVolume.compareTo(new BigDecimal("20000000000")) < 0) {
            return new BigDecimal("0.0003"); // Gold: 0.03%
        } else {
            return new BigDecimal("0.0001"); // VIP: 0.01%
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

    private OrderResponseDto toDto(Order order) {
        return OrderResponseDto.builder()
                .orderId(order.getOrderId())
                .orderType(order.getOrderType())
                .priceType(order.getPriceType())
                .assetType(order.getAssetType())
                .price(order.getPrice())
                .amount(order.getAmount())
                .filledAmount(order.getFilledAmount())
                .status(order.getStatus())
                .createdAt(order.getCreatedAt())
                .build();
    }
}
