#!/usr/bin/env bash
# Ativa a toolchain PHP 8.4 (mise) para desenvolvimento local do backend Laravel neste sandbox.
# Uso: source backend-dev-env.sh   (ou: . backend-dev-env.sh)
# Nota: caminhos específicos do sandbox; em CI o PHP já está no PATH (não use este arquivo lá).
export PATH="/root/.local/share/mise/installs/php/8.4/bin:${PATH}"
export LD_LIBRARY_PATH="/inner_container/usr/lib64:${LD_LIBRARY_PATH:-}"
