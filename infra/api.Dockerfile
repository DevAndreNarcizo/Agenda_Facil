FROM php:8.5-cli-bookworm
ARG AGENDA_BUILD_JOBS=2

RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq-dev libzip-dev libicu-dev libpng-dev unzip git \
    && docker-php-ext-install -j${AGENDA_BUILD_JOBS} pdo_pgsql pgsql bcmath intl zip pcntl gd \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
WORKDIR /app
EXPOSE 8000
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]
