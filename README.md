# El Último Capítulo: pedidos web para una panadería, en la nube

> «Cada día comienza una nueva historia»

Proyecto final de **Arquitectura Cloud para una PyME** (Prof. Luis Carlos Galvis).
Autor: Johan Sebastián Beltrán Gutiérrez (proyecto individual).

Una panadería de barrio recibe pedidos por internet para recogerlos en tienda, sin servidores propios y con un costo mensual por debajo de USD 150.

**Sitio en vivo (MVP):** https://elultimocapitulo2026.z22.web.core.windows.net

El MVP permite **consultar la carta** y **registrar un pedido** con nombre y hora de recogida.

## Arquitectura

| Capa | Producción (diseño, AWS) | MVP desplegado (Azure) |
|---|---|---|
| Sitio estático | S3 + CloudFront + WAF | Azure Storage (sitio web estático) |
| API | API Gateway + Lambda (Python) | Azure Functions (Python 3.11, plan Consumption) |
| Datos | DynamoDB on-demand + PITR | Azure Table Storage |
| Secretos | Secrets Manager | GitHub Secrets |
| Observabilidad | CloudWatch | Registros de Functions y Cost Management |

El MVP corre de verdad en **Azure for Students** (AWS exigía tarjeta de crédito). La arquitectura de producción sigue siendo AWS serverless, y el detalle y las decisiones (ADR) están en el HLD. Como plan B se conserva una variante local sobre [Floci](https://github.com/floci-io/floci), un emulador de AWS.

## Pipeline de despliegue (GitHub Actions)

`push a main` → **lint** (flake8) → **pruebas** (pytest) → **deploy API** (Functions) y **deploy sitio** (Storage) → **smoke test**

- Archivo: `.github/workflows/azure.yml` (MVP real en Azure).
- Archivo: `.github/workflows/deploy.yml` (variante local con Floci y Terraform).
- Las pruebas y el lint **bloquean el despliegue**: si fallan, nada se publica.
- El *smoke test* comprueba que el sitio carga y que la API responde con la carta.
- Un *pull request* solo ejecuta lint y pruebas, sin desplegar.

### Secretos (GitHub → Settings → Secrets and variables → Actions)

| Secreto | Para qué |
|---|---|
| `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` | Publicar la API en Azure Functions |
| `AZURE_STORAGE_CONNECTION_STRING` | Publicar el sitio en Azure Storage |

No hay credenciales en el repositorio.

## Estructura

```
frontend/            sitio estático (HTML, CSS y JS)
azure/api/           API en Azure Functions (Python)
tests/               pruebas con pytest
infra/               Terraform (variante Floci)
scripts/             despliegue local y smoke test
.github/workflows/   pipelines (azure.yml y deploy.yml)
```

## Ejecutar pruebas y lint en local

```bash
pip install pytest flake8
flake8 azure tests/test_azure_validation.py --max-line-length=100
pytest -q
```

## Variante local con Floci (plan B)

Requisitos: Docker, Terraform, AWS CLI y Python 3.12.

```bash
docker run -d --name floci -p 4566:4566 \
  -v /var/run/docker.sock:/var/run/docker.sock floci/floci:latest
bash scripts/deploy.sh
bash scripts/smoke_test.sh
cat .site_url   # abrir en el navegador
```

## Rollback

Se hace `git revert <commit>` del cambio defectuoso y `git push` a `main`. El pipeline vuelve a desplegar la versión anterior.

## Seguridad

- Secretos solo en GitHub Secrets; nunca en el repositorio.
- Acceso por HTTPS.
- En producción: rol IAM de mínimo privilegio (solo sus tablas y logs), WAF en el borde y Checkov sobre el Terraform.
- Alerta de presupuesto de USD 5 al mes en Azure Cost Management.

## Costos

- MVP en Azure: cercano a cero dentro del crédito de USD 100 de Azure for Students.
- Producción en AWS (estimación de la calculadora de AWS, us-east-1): **~USD 16.52 al mes** (USD 198.24 al año), y unos USD 27 en temporada alta, por debajo del tope de USD 150.
- Estimación pública: https://calculator.aws/#/estimate?id=8d64572dccd1acab35b0b5ff291ab923e0c9b19d
- Optimizaciones FinOps: cachear la carta en CloudFront, bajar Lambda de 256 a 128 MB y apagar PITR en desarrollo.

## Documentación

El HLD (8 secciones y 3 ADR), los diagramas (C4, arquitectura, red y pipeline), el Excel de costos y la presentación están en la carpeta `docs/` y en la entrega de la plataforma.

> Al terminar la sustentacion , los recursos de Azure se eliminan para no generar costos.