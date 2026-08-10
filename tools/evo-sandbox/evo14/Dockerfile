# Evolution CMS 1.4.18 — the version the parish reportedly runs.
#
# 1.4.18 is a PHP 5.6-era codebase; 7.4 is the newest interpreter it is
# comfortable on. The tag ships its own vendor/ directory, so there is no
# Composer step.
FROM php:7.4-apache

# mysqli and pdo_mysql compile against libraries already in the base image, so
# this needs no apt-get. That matters: php:7.4-apache is Debian bullseye, whose
# package mirrors are on their way to archive, and a build that never calls
# apt-get cannot be broken by that.
RUN set -eux; \
    docker-php-ext-install -j"$(nproc)" mysqli pdo_mysql; \
    a2enmod rewrite; \
    # EVO's .htaccess carries its rewrite rules, and it installs with friendly
    # URLs on. The php:*-apache images ship AllowOverride None, which makes the
    # file inert and turns every page into a 404.
    sed -ri -e 's!AllowOverride None!AllowOverride All!g' /etc/apache2/apache2.conf

ARG EVO_VERSION=1.4.18

# Staged in /usr/src/evo, not /var/www/html. The webroot is a named volume so
# manager edits survive a restart, and the entrypoint populates it on first boot.
RUN set -eux; \
    mkdir -p /usr/src/evo; \
    curl -fsSL "https://github.com/evolution-cms/evolution/archive/refs/tags/${EVO_VERSION}.tar.gz" -o /tmp/evo.tgz; \
    tar -xzf /tmp/evo.tgz -C /usr/src/evo --strip-components=1; \
    rm /tmp/evo.tgz

COPY entrypoint.sh /usr/local/bin/ntgoc-entrypoint
COPY seed.php /opt/ntgoc/seed.php
COPY template/ntgoc.tpl /opt/ntgoc/template/ntgoc.tpl
RUN chmod +x /usr/local/bin/ntgoc-entrypoint

ENV EVO_MAJOR=1
ENTRYPOINT ["/usr/local/bin/ntgoc-entrypoint"]
CMD ["apache2-foreground"]
