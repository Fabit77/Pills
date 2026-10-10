# Pills en Stellar Testnet

## Estado actual

- Red: Stellar Testnet.
- Contrato NFT: `CD3TDAKQK2TXG2TXT7V3DU4MOHL3AYP7LBRKNBD7LDQDHYTSZA6W7JGN`.
- WASM: `ab54a3d7db69ddf6a00169be4f6afae5797c267584a03ceb13cbc95e3c84d168`.
- Despliegue: `7fe13d5ae964d78137b17353f0eadee341fd22d7ed3bce4d8c8ab417b843f2cf`.
- Las 10 Pills aprobadas existentes están registradas on-chain.
- Los 19 claims existentes conservan número de edición y trabajo de mint idempotente.
- Cada usuario activa una smart wallet con passkey. La clave privada permanece en el dispositivo o gestor de credenciales.
- La cuenta puede sincronizar hasta tres NFTs inmediatamente desde **Mi perfil**.
- Un cron diario compatible con Vercel Hobby procesa hasta cinco trabajos como respaldo.

## Variables requeridas en producción

Variables privadas:

- `STELLAR_NETWORK=testnet`
- `STELLAR_RPC_URL=https://soroban-testnet.stellar.org`
- `STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015`
- `STELLAR_CONTRACT_ID`
- `STELLAR_MINTER_PUBLIC_KEY`
- `STELLAR_MINTER_SECRET`
- `STELLAR_DEPLOYMENT_KEY=hackathon-testnet-v1`
- `CRON_SECRET`

Variables públicas:

- `NEXT_PUBLIC_STELLAR_RPC_URL`
- `NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE`
- `NEXT_PUBLIC_STELLAR_ACCOUNT_WASM_HASH`
- `NEXT_PUBLIC_STELLAR_WEBAUTHN_VERIFIER`
- `NEXT_PUBLIC_STELLAR_RELAYER_URL`

Nunca copiar `STELLAR_MINTER_SECRET`, `CRON_SECRET` ni credenciales de Supabase a variables `NEXT_PUBLIC_*`.

## Demostración para la hackathon

1. Iniciar sesión con una cuenta que tenga una Pill coleccionada.
2. Abrir Creator Studio → Mi perfil.
3. Pulsar **Activar con passkey** y confirmar con biometría o PIN.
4. Esperar la ejecución del worker o invocarlo manualmente con `POST /api/internal/stellar/process` y `Authorization: Bearer $CRON_SECRET`.
5. Abrir el detalle de la Pill y comprobar su `mint_tx_hash` en Stellar Expert Testnet.
6. Volver a entrar con otro método vinculado al mismo usuario. La dirección debe mantenerse porque la relación usa `auth.users.id`.

## Reinicio después de la hackathon

El reinicio de la aplicación y el reinicio de Testnet son operaciones distintas. Un borrado de Supabase no elimina las transacciones ya escritas en Stellar. Para separar los datos nuevos se usa otro `deployment_key` y, si se desea una separación total, se despliega un contrato nuevo.

Procedimiento:

1. Desactivar temporalmente la creación y colección.
2. Ejecutar `npm run backup:supabase` y verificar que el manifiesto termine sin advertencias.
3. Conservar el backup fuera del repositorio.
4. Detener el cron del worker.
5. Cambiar `STELLAR_DEPLOYMENT_KEY` a un valor nuevo, por ejemplo `post-hackathon-testnet-v1`.
6. Desplegar un contrato NFT nuevo para el nuevo conjunto de datos y actualizar `STELLAR_CONTRACT_ID` y `nft_contracts`.
7. Eliminar primero los datos funcionales de prueba —momentos, claims, campañas, colecciones y organizaciones— respetando sus claves foráneas.
8. Eliminar después los usuarios de Auth que no se conservarán. Al borrarlos se eliminan sus perfiles y wallets por cascada.
9. Limpiar los archivos de los buckets de prueba.
10. Crear nuevamente la cuenta administradora y sus roles.
11. Aplicar un smoke test con un usuario nuevo, una Pill nueva, una colección y un mint.
12. Reactivar el cron y el acceso público.

No se ejecuta este reinicio automáticamente. Requiere una ventana de mantenimiento, backup verificado y una lista explícita de cuentas que deben conservarse.

## Paso a Mainnet

Mainnet requiere un contrato nuevo, variables nuevas, llaves administrativas en un gestor de secretos, recuperación de passkeys, revisión de seguridad y un piloto cerrado. No se migran direcciones ni transacciones desde Testnet; se registra una correspondencia entre los objetos del piloto y sus nuevos identificadores de Mainnet.
