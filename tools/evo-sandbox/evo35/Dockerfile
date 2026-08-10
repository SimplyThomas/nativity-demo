# Evolution CMS 3.5.7 — the current release, here so the 1.4.x-versus-3.x
# question can be settled by looking at both.
#
# composer.json requires php ^8.3 plus ext-pdo, ext-json, ext-readline and
# ext-zip. The tag ships core/vendor, so there is no Composer step.
FROM php:8.3-apache

# composer.json also lists ext-readline. It is deliberately NOT built here.
#
# On php:8.3 (Debian bookworm) the extension's configure insists on libedit
# ("checking for libedit readline replacement... yes"), and readline.c then
# fails to compile against it — 'rl_mark' and 'rl_pending_input' are GNU-only
# symbols. --with-readline does not override the choice.
#
# Nothing here needs it. readline() is only reached by the installer's
# interactive fallback, which this sandbox never uses: entrypoint.sh passes
# every argument and closes stdin. Without the extension a missing argument
# raises "Call to undefined function readline()" and the container exits
# immediately, which is the fast, loud failure the entrypoint is designed
# around anyway.
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends libzip-dev git unzip; \
    docker-php-ext-install -j"$(nproc)" mysqli pdo_mysql zip; \
    a2enmod rewrite; \
    # EVO's .htaccess carries its rewrite rules, and it installs with friendly
    # URLs on. The php:*-apache images ship AllowOverride None, which makes the
    # file inert and turns every page into a 404.
    sed -ri -e 's!AllowOverride None!AllowOverride All!g' /etc/apache2/apache2.conf; \
    rm -rf /var/lib/apt/lists/*

ARG EVO_VERSION=3.5.7

# Cloned, not downloaded as a tarball — and that is not a preference.
#
# 3.5.7's .gitattributes contains `LICENSE export-ignore`, and that pattern
# matches every path component named LICENSE, not just the one at the root. The
# GitHub source tarball therefore ships without
# core/vendor/composer/composer/LICENSE, which the bundled Composer opens on
# startup; the installer's `composer update` step dies with
# "fopen(.../LICENSE): No such file or directory". README.md is stripped the
# same way. export-ignore does not apply to a clone, so this tree is complete.
RUN set -eux; \
    git clone --depth 1 --branch "${EVO_VERSION}" --single-branch \
        https://github.com/evolution-cms/evolution.git /usr/src/evo; \
    rm -rf /usr/src/evo/.git

# The installer runs `composer update --working-dir=core` itself, at install
# time. Doing it here as well means that step finds everything current: the
# container boots in seconds instead of downloading ninety packages, and a
# sandbox with no network still installs (the installer treats a failing
# composer as a warning, not an error).
RUN set -eux; \
    cd /usr/src/evo; \
    php core/vendor/bin/composer update --no-interaction --prefer-dist --no-progress --working-dir=core

COPY entrypoint.sh /usr/local/bin/ntgoc-entrypoint
COPY seed.php /opt/ntgoc/seed.php
COPY template/ntgoc.tpl /opt/ntgoc/template/ntgoc.tpl
RUN chmod +x /usr/local/bin/ntgoc-entrypoint

ENV EVO_MAJOR=3
ENTRYPOINT ["/usr/local/bin/ntgoc-entrypoint"]
CMD ["apache2-foreground"]
