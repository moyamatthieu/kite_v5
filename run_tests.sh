#!/usr/bin/env bash

# run_tests.sh - Lanceur des tests de validation Phase 5
# Utilisation: ./run_tests.sh [test_name]

set -e

echo "🧪 Lanceur de Tests - Phase 5 ECS Migration"
echo "=========================================="

cd "$(dirname "$0")"

if [ "$1" = "migration" ] || [ "$1" = "" ]; then
    echo "▶️ Lancement validation migration..."
    npx tsx docs/tests/validate_migration.ts
    echo "✅ Validation migration terminée"
fi

if [ "$1" = "final" ] || [ "$1" = "" ]; then
    echo "▶️ Lancement test final ECS..."
    npx tsx docs/tests/test_final_ecs.ts
    echo "✅ Test final ECS terminé"
fi

echo ""
echo "🎉 Tous les tests Phase 5 réussis !"
echo "📊 Architecture ECS validée et fonctionnelle"