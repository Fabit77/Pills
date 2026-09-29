import { Ban, PauseCircle } from "lucide-react";

export default async function AccountRestricted({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const blocked = status === "blocked";
  return <main className="restricted-shell"><section className="restricted-card"><span>{blocked ? <Ban /> : <PauseCircle />}</span><small>CUENTA {blocked ? "BLOQUEADA" : "PAUSADA"}</small><h1>{blocked ? "Tu acceso fue bloqueado." : "Tu perfil está pausado."}</h1><p>{blocked ? "Un Super Admin debe revisar y desbloquear este correo antes de que puedas volver a entrar." : "La cuenta y su contenido no están visibles temporalmente. Un administrador puede reactivarla."}</p><form action="/auth/signout" method="post"><button type="submit">Cerrar sesión</button></form></section></main>;
}
