FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY ["TrainRekt.Api.csproj", "./"]
RUN dotnet restore "./TrainRekt.Api.csproj"

COPY . .
RUN dotnet publish "./TrainRekt.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080

COPY --from=build /app/publish .

ENTRYPOINT ["sh", "-c", "ASPNETCORE_URLS=${ASPNETCORE_URLS:-http://0.0.0.0:${PORT:-8080}} exec dotnet TrainRekt.Api.dll"]