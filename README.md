# Panadería El Último Capítulo: MVP en la nube (sobre Floci)

Pedidos web para recoger. MVP: consultar el catalogo y registrar un pedido.

## Arquitectura (MVP)
- **Frontend:** sitio estatico en S3
- **API:** API Gateway (REST, proxy) + Lambda (Python 3.12)
- **Datos:** DynamoDB (`products`, `orders`)
- **IaC:** Terraform (`infra/`)
- **CI/CD:** GitHub Actions (`.github/workflows/deploy.yml`)
- **Entorno:** [Floci](https://github.com/floci-io/floci), emulador local de AWS en el puerto 4566

## Pipeline
`push/PR -> lint + pruebas + Checkov -> levantar Floci -> terraform apply -> carga de datos y sitio -> smoke test`

Las pruebas bloquean el despliegue: el job `deploy` depende de `test`.

## Ejecutar en local
Requisitos: Docker, Terraform, AWS CLI, Python 3.12.

```bash
docker run -d --name floci -p 4566:4566 \
  -v /var/run/docker.sock:/var/run/docker.sock floci/floci:latest
pip install pytest && pytest -q
bash scripts/deploy.sh
bash scripts/smoke_test.sh
cat .site_url   # abrir en el navegador
```

## Rollback
Volver a la version anterior: `git revert <commit>` y push a `main`; el pipeline
vuelve a desplegar la version previa. Terraform y el sitio se reconstruyen desde el repo.

## Seguridad
- No hay credenciales reales en el repo (Floci usa valores de prueba `test`).
- El rol de la Lambda tiene minimo privilegio (solo sus tablas y logs).
