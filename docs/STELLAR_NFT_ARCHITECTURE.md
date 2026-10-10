# Arquitectura Stellar para Pills

## Decisión principal

Cada **ejemplar coleccionado** de una Pill será un NFT único en un único contrato Soroban de Pills. La campaña creada en Creator Studio seguirá siendo la plantilla de la colección; cada fila de `collectible_claims` será una edición concreta y tendrá su propio `token_id`.

No se creará un activo Stellar Classic distinto por cada Pill. Ese enfoque obliga a gestionar códigos, emisores y trustlines y representa peor una colección de objetos únicos. El contrato se basará en el módulo NFT de OpenZeppelin para Stellar, fijado a una versión concreta, con las extensiones necesarias de `burn` y enumeración.

## Identidad y wallet

La wallet pertenece al `auth.users.id` de Supabase, no al correo ni al proveedor de acceso.

- Un usuario de Pills tiene como máximo una wallet activa por red.
- El correo, Google y futuros proveedores son métodos de acceso al mismo usuario.
- Si Supabase enlaza automáticamente dos identidades con el mismo correo verificado, ambas usan el mismo `auth.users.id` y, por tanto, la misma wallet.
- Si la persona vincula manualmente otro proveedor desde una sesión iniciada, se usa `linkIdentity`; no se crea otra wallet.
- Si el proveedor ya pertenece a otro usuario, no se fusionan wallets automáticamente. Se requiere un flujo explícito de recuperación o fusión con comprobación de control de ambas cuentas.

### Custodia recomendada

Usar una **smart wallet Soroban controlada con passkey**. La clave privada de la passkey queda en el dispositivo o gestor de credenciales del usuario. En la primera versión, Pills guarda solamente la dirección `C...` del contrato-wallet; el SDK conserva la credencial en el almacenamiento seguro del navegador y verifica su control contra la cadena al reconectar.

Pills patrocina las comisiones para que coleccionar una Pill no requiera XLM ni instalar una extensión.

La wallet se prepara de forma diferida:

1. La cuenta de Pills se crea normalmente con correo, magic link o Google.
2. En la primera acción blockchain —primera colección, abrir “Mi wallet” o transferir— se solicita crear una passkey.
3. Se despliega la smart wallet en testnet y se vincula al `user_id` interno.
4. Las siguientes Pills llegan a la misma wallet aunque el usuario entre por otro proveedor vinculado.

Este flujo evita desplegar wallets para cuentas abandonadas y mantiene la experiencia inicial sencilla. Se puede anticipar la creación al onboarding cuando el producto esté listo para explicarla bien.

### Recuperación

Antes de mainnet se debe permitir registrar al menos dos credenciales:

- passkey principal;
- passkey de respaldo en otro dispositivo o gestor sincronizado;
- recuperación asistida opcional con demora y notificaciones, sin convertir el correo por sí solo en autorización para transferir NFTs.

El login de Pills recupera la cuenta de la aplicación. La passkey autoriza movimientos de la wallet. Son dos responsabilidades distintas.

## Contrato NFT de Pills

Un contrato por red:

- `PillsNFT` en testnet;
- una nueva instancia independiente en mainnet.

Funciones mínimas:

- `register_campaign(campaign_ref, metadata_uri, content_hash, max_supply)` — registra cada Pill aprobada antes de que alguien la coleccione.
- `mint(to, token_id, metadata_uri, content_hash, campaign_ref)` — solo rol `MINTER` de Pills.
- `owner_of(token_id)`.
- `token_uri(token_id)`.
- `transfer(from, to, token_id)` — autorizado por el propietario.
- `burn(owner, token_id)` — autorizado por el propietario.
- `pause/unpause` — solo para emergencia.
- rotación de roles administrativos mediante multisig.

Eventos mínimos:

- `campaign_registered(campaign_ref, content_hash, max_supply)`;
- `minted(token_id, owner, campaign_ref)`;
- `transferred(token_id, from, to)`;
- `burned(token_id, owner, reason_hash)`.

El contrato no guardará correos, nombres, imágenes ni datos personales.

### Identificadores

- `token_id`: entero derivado de una secuencia propia en base de datos, no del correo ni del UUID expuesto directamente.
- `campaign_ref`: hash del UUID de la campaña.
- `content_hash`: SHA-256 del archivo exacto entregado al aprobar la Pill.
- `metadata_uri`: endpoint público versionado de Pills, por ejemplo `https://pills.social/api/nft/metadata/{token_id}`.

## Metadatos e imágenes

La imagen seguirá en Supabase Storage u otro almacenamiento controlado por Pills. No se debe usar almacenamiento inmutable para el archivo visual si el producto promete retirarlo.

El endpoint de metadatos devuelve:

- nombre y descripción;
- edición y suministro;
- creador y fecha del evento;
- URL de imagen mientras esté visible;
- red, contrato y `token_id`;
- estado `active`, `burned`, `hidden` o `image_removed`.

El hash on-chain permite demostrar cuál fue el archivo original aunque posteriormente se retire la imagen.

## Flujo de creación y colección

### Creación de una Pill

1. El creador guarda y envía la campaña a curaduría como hoy.
2. Al aprobarse, se congela una versión del arte y se calcula `content_hash`.
3. Un worker ejecuta `register_campaign` y guarda su transacción y ledger. Desde ese momento la Pill ya tiene un registro verificable en Stellar aunque nadie la haya coleccionado.
4. Aún no se acuñan todos los NFTs: se acuña cada edición cuando una persona la colecciona. Esto evita pagar y almacenar unidades que nunca se reclamarán.

### Coleccionar

1. El usuario inicia sesión.
2. El backend crea la fila de claim y reserva el siguiente número de edición en una transacción de base de datos.
3. Si no tiene wallet, completa la creación de passkey y wallet.
4. Un worker idempotente envía `mint` a Soroban y Pills patrocina la comisión.
5. Al confirmarse la transacción se guardan `token_id`, contrato, hash de transacción, ledger y estado `minted`.
6. La interfaz muestra la Pill inmediatamente como `procesando en Stellar` y luego como `verificada en Stellar`.

No se debe mantener una transacción HTTP abierta esperando confirmación. La acuñación funciona como un trabajo reintentable y el mismo claim nunca puede generar dos tokens.

## Quemar una Pill

Quemar es irreversible y requiere una firma de la wallet propietaria.

1. El usuario abre el detalle y selecciona “Quemar Pill”.
2. La interfaz muestra qué desaparecerá y solicita confirmación con passkey.
3. La wallet firma `burn(owner, token_id)`.
4. Tras confirmación, el claim queda con `burned_at`, `burn_tx_hash` y `visibility = burned`.
5. La Pill deja de aparecer en la colección, perfiles, búsquedas y conteos activos.
6. El endpoint de metadatos devuelve un registro de NFT quemado sin la imagen.

El evento de quema y la transacción permanecen en Stellar. Eso es el registro histórico que no se puede borrar.

### Regla para la imagen compartida

Hoy todas las ediciones de una campaña usan la misma imagen. Quemar una edición no debe borrar el archivo para los demás propietarios. La aplicación oculta la imagen únicamente en el registro quemado.

La eliminación física del archivo de Storage solo ocurre cuando:

- el creador retira la imagen de toda la campaña; o
- todas las ediciones fueron quemadas y la política de retención autoriza eliminarla.

Si una imagen se elimina físicamente, la campaña queda con `artwork_removed_at` y los metadatos de todas sus ediciones activas muestran un marcador “imagen retirada”. La propiedad y el hash continúan en Stellar.

## Cambios de base de datos

### `stellar_wallets`

- `id uuid`
- `user_id uuid`
- `network testnet | mainnet`
- `contract_address text`
- `status pending | deploying | active | recovery | disabled`
- `deployment_tx_hash text`
- `created_at`, `activated_at`
- único por `(user_id, network)`

### `wallet_credentials`

- `wallet_id uuid`
- `credential_id text`
- `public_key text`
- `label text`
- `created_at`, `revoked_at`, `last_used_at`

Nunca guarda claves privadas.

### `nft_contracts`

- `network`
- `contract_address`
- `wasm_hash`
- `version`
- `deployer_address`
- `deployed_tx_hash`
- `active`

### Campos nuevos en `campaigns`

- `content_hash text`
- `artwork_frozen_at timestamptz`
- `artwork_removed_at timestamptz`
- `blockchain_status pending | submitted | ready | failed`
- `blockchain_network testnet | mainnet`
- `blockchain_contract_address text`
- `blockchain_tx_hash text`
- `blockchain_ledger bigint`

### Campos nuevos en `collectible_claims`

- `edition_number integer`
- `network testnet | mainnet`
- `contract_address text`
- `token_id bigint`
- `mint_status pending | submitted | minted | failed | burned`
- `mint_tx_hash text`
- `mint_ledger bigint`
- `minted_at timestamptz`
- `burn_tx_hash text`
- `burn_ledger bigint`
- `burned_at timestamptz`
- `visibility active | hidden | burned`

Restricciones únicas sobre `(network, contract_address, token_id)`, `mint_tx_hash` y `(campaign_id, edition_number)`.

### `blockchain_jobs`

Cola idempotente para `deploy_wallet`, `mint`, `transfer`, `burn`, `refresh_status` y `extend_ttl`, con intentos, error y clave de idempotencia.

## Fases

### Fase 0 — especificación y seguridad

- Congelar interfaz del contrato y modelo de metadatos.
- Definir roles, multisig y política de recuperación.
- Añadir migraciones y estados sin cambiar todavía el flujo visible.
- Elegir proveedor RPC y servicio de patrocinio de comisiones.

### Fase 1 — testnet técnica

- Crear cuentas administrativas testnet.
- Implementar y probar el contrato con OpenZeppelin fijado a una versión.
- Desplegar `PillsNFT` en testnet.
- Implementar worker, indexación de eventos y reconciliación.
- Usar OpenZeppelin Relayer/Channels para patrocinar las comisiones de las smart wallets; no depender de Launchtube, que fue discontinuado.
- Acuñar, transferir y quemar NFTs de prueba mediante scripts internos.

### Fase 2 — testnet integrada

- Añadir passkeys y wallet por usuario.
- Conectar la colección actual con mint asíncrono.
- Mostrar estado y enlace al explorador.
- Implementar quema y ocultamiento de imagen.
- Probar reintentos, doble clic, fallo de RPC, pérdida de dispositivo y cuentas con identidades vinculadas.

### Fase 3 — piloto cerrado

- Activar blockchain solo para campañas seleccionadas.
- Medir coste por mint, tiempos de confirmación y errores.
- Ejecutar revisión externa del contrato y modelo de recuperación.
- Preparar llaves mainnet en un gestor de secretos y administración multisig.

### Fase 4 — mainnet

- Desplegar un contrato nuevo en mainnet; nunca reutilizar direcciones ni transacciones de testnet.
- Crear una wallet mainnet por usuario al primer uso en esa red.
- Remintar únicamente Pills del piloto que cumplan la política de migración y conservar una tabla de correspondencia testnet/mainnet.
- Lanzar por porcentaje, con pausa operativa y reconciliación diaria.

## Reglas de seguridad antes de mainnet

- Ninguna seed o clave privada en Supabase, Vercel, el navegador o el repositorio.
- Llaves administrativas en KMS/HSM o servicio de firma y control multisig.
- Contrato con versión fijada, pruebas unitarias e integración y auditoría externa.
- Todas las operaciones blockchain idempotentes y reconciliadas contra RPC.
- Rate limits para mint y burn.
- Confirmación fuerte para burn y transferencia.
- Monitoreo de fondos para comisiones, fallos del worker, eventos desconocidos y diferencias entre base de datos y cadena.
- Procedimiento documentado para pausar mint sin bloquear la lectura de colecciones existentes.

## Criterios de aceptación del piloto testnet

1. Una cuenta con correo recibe una wallet y un NFT al coleccionar.
2. La misma persona vincula Google y conserva el mismo `user_id`, wallet y colección.
3. Un reintento del claim no crea un segundo NFT.
4. La propiedad consultada en Soroban coincide con Pills.
5. El usuario transfiere una edición a otra wallet y el sitio se reconcilia.
6. El usuario quema una edición; desaparece del sitio, la imagen no se entrega para ese token y el evento permanece verificable.
7. Quemar una edición no elimina la imagen para otros propietarios de la misma campaña.
8. Una caída temporal del RPC no pierde el claim y el worker completa el mint al recuperarse.

## Decisiones que quedan abiertas

- Proveedor RPC/indexación y patrocinio de comisiones.
- Política exacta de recuperación asistida.
- Si las transferencias entre usuarios estarán habilitadas desde el piloto o después.
- Política legal y de retención para retirar imágenes de campañas completas.
- Auditoría y responsables de la multisig mainnet.
