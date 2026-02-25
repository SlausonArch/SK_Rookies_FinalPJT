package com.rookies.sk;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class SkApplication {

	public static void main(String[] args) {
		SpringApplication.run(SkApplication.class, args);
	}

}
