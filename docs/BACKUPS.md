# Respaldos de Pills

`npm run backup:supabase` crea una copia local privada en `backups/<fecha>/`.

Incluye los datos de producto, usuarios e identidades de autenticación, registros de auditoría disponibles y todos los archivos de `collectible-artwork`. Las sesiones y refresh tokens se excluyen intencionalmente: no deben restaurarse ni conservarse fuera del sistema de autenticación.

Cada respaldo contiene `manifest.json` con cantidades, tamaños y hashes SHA-256. Los archivos se crean con permisos restringidos y se eliminan automáticamente después de 56 días.

La carpeta `backups/` está excluida de Git. Contiene datos personales y nunca debe subirse a GitHub, enviarse por correo ni copiarse a una carpeta pública. Para una segunda copia, usa un disco cifrado o almacenamiento privado con cifrado y acceso restringido.

## Restauración

Las migraciones del repositorio reconstruyen el esquema. Los JSON conservan los registros para recuperación controlada y auditoría. La restauración debe ejecutarse en un proyecto vacío, respetando el orden de claves foráneas, y requiere un script revisado para el incidente concreto.
