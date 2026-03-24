# Package stage (pre-built JAR)
FROM eclipse-temurin:17-jre-jammy
WORKDIR /app
COPY build/libs/*.jar app.jar
COPY docs ./docs
EXPOSE 18080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
