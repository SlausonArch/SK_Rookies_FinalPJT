# Build stage
FROM gradle:8.5-jdk17 AS build
WORKDIR /home/gradle/src
COPY --chown=gradle:gradle build.gradle settings.gradle gradlew gradlew.bat ./
COPY --chown=gradle:gradle gradle ./gradle
COPY --chown=gradle:gradle src ./src
RUN gradle build --no-daemon -x test

# Package stage
FROM eclipse-temurin:17-jre-jammy
COPY --from=build /home/gradle/src/build/libs/*.jar app.jar
EXPOSE 18080
ENTRYPOINT ["java", "-jar", "/app.jar"]
