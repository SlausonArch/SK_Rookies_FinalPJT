package com.rookies.sk.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class TransactionConstraintInitializer implements ApplicationRunner {

    private static final String TX_TYPE_CONSTRAINT_SQL = """
            ALTER TABLE TRANSACTIONS ADD CONSTRAINT CHK_TX_TYPE CHECK (TX_TYPE IN (
                'BUY', 'SELL', 'DEPOSIT', 'WITHDRAW', 'FEE',
                'ADMIN_RECLAIM', 'ATTENDANCE_REWARD', 'AD_MISSION_REWARD'
            ))
            """;

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        ensureTransactionTxTypeConstraint();
    }

    private void ensureTransactionTxTypeConstraint() {
        try {
            List<String> txTypeConstraints = jdbcTemplate.queryForList("""
                    SELECT CONSTRAINT_NAME
                    FROM USER_CONSTRAINTS
                    WHERE TABLE_NAME = 'TRANSACTIONS'
                      AND CONSTRAINT_TYPE = 'C'
                      AND UPPER(NVL(SEARCH_CONDITION_VC, '')) LIKE '%TX_TYPE%'
                    """, String.class);

            for (String constraintName : txTypeConstraints) {
                jdbcTemplate.execute("ALTER TABLE TRANSACTIONS DROP CONSTRAINT " + constraintName);
                log.info("TRANSACTIONS TX_TYPE constraint dropped: {}", constraintName);
            }

            jdbcTemplate.execute(TX_TYPE_CONSTRAINT_SQL);
            log.info("TRANSACTIONS TX_TYPE constraint aligned for event rewards");
        } catch (Exception e) {
            log.warn("TRANSACTIONS TX_TYPE constraint alignment skipped: {}", e.getMessage());
        }
    }
}
