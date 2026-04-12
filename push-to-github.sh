#!/bin/bash
git remote add github https://yogeshyowan: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@github.com/yogeshyowan/qwikapp.git 2>/dev/null || \
git remote set-url github https://yogeshyowan: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@github.com/yogeshyowan/qwikapp.git
git push github main
echo "Done! Your project is now on GitHub."
