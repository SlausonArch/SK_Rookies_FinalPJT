# Run stage (pre-built JAR via local Gradle)
FROM eclipse-temurin:17-jre-jammy
WORKDIR /app
COPY build/libs/sk-0.0.1-SNAPSHOT.jar app.jar
COPY docs ./docs
EXPOSE 18080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
