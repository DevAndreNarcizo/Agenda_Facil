#!/usr/bin/env bash
# Ativa a toolchain PHP 8.4 (mise) para desenvolvimento local do backend Laravel.
# Uso: source backend-dev-env.sh   (ou: . backend-dev-env.sh)
export PATH="/root/.local/share/mise/installs/php/8.4/bin:${PATH}"
export LD_LIBRARY_PATH="/inner_container/usr/lib64:${LD_LIBRARY_PATH}"
