FROM evoapicloud/evolution-api:latest

COPY infra/evolution/apply-wavoip-baileys-patch.mjs /wavoip-patch/
COPY infra/evolution/entrypoint-wavoip.sh /wavoip-patch/

RUN chmod +x /wavoip-patch/entrypoint-wavoip.sh

ENTRYPOINT ["/bin/bash", "/wavoip-patch/entrypoint-wavoip.sh"]
