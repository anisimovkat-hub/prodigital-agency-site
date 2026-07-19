import Link from "next/link";

import { InviteForm } from "@/app/(dashboard)/employees/invite-form";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { USER_ROLE_LABEL } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { formatDate, todayISO } from "@/lib/format";

export default async function EmployeesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profiles }, { data: tasks }, { data: members }, { data: invites }] =
    await Promise.all([
      supabase.from("profiles").select("*").order("full_name"),
      supabase.from("tasks").select("assignee_id,status,due_date"),
      supabase
        .from("project_members")
        .select("profile_id, project:projects(stage)"),
      supabase
        .from("invite_codes")
        .select("*")
        .is("used_at", null)
        .order("created_at", { ascending: false }),
    ]);

  const isAdmin =
    (profiles ?? []).find((p) => p.id === user?.id)?.role === "owner";

  const today = todayISO();

  const loadByEmployee = new Map<
    string,
    { open: number; today: number; overdue: number }
  >();
  for (const task of tasks ?? []) {
    if (!task.assignee_id) continue;
    const stats = loadByEmployee.get(task.assignee_id) ?? {
      open: 0,
      today: 0,
      overdue: 0,
    };
    if (task.status !== "done") {
      stats.open += 1;
      if (task.due_date === today) stats.today += 1;
      if (task.due_date && task.due_date < today) stats.overdue += 1;
    }
    loadByEmployee.set(task.assignee_id, stats);
  }

  const activeProjectsByEmployee = new Map<string, number>();
  for (const member of members ?? []) {
    if (member.project?.stage !== "active") continue;
    activeProjectsByEmployee.set(
      member.profile_id,
      (activeProjectsByEmployee.get(member.profile_id) ?? 0) + 1,
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">
          Сотрудники
        </h1>
        <p className="text-sm text-neutral-500">
          Команда агентства и текущая загрузка.
        </p>
      </div>

      {isAdmin && (
        <details className="group rounded-lg border border-neutral-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-neutral-900">
            + Пригласить сотрудника
          </summary>
          <div className="mt-4 flex flex-col gap-4">
            <InviteForm signupUrl="agency-os-lilac-eight.vercel.app/signup" />
            {(invites ?? []).length > 0 && (
              <div className="text-sm">
                <p className="mb-1 font-medium text-neutral-700">
                  Активные коды:
                </p>
                <ul className="flex flex-col gap-0.5 text-neutral-600">
                  {(invites ?? []).map((invite) => (
                    <li key={invite.code}>
                      <code>{invite.code}</code>
                      {invite.full_name ? ` — ${invite.full_name}` : ""} ·{" "}
                      {USER_ROLE_LABEL[invite.role]} · до{" "}
                      {formatDate(invite.expires_at)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </details>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Имя</TableHead>
            <TableHead>Роль</TableHead>
            <TableHead>Должность</TableHead>
            <TableHead>Активные проекты</TableHead>
            <TableHead>Сегодня</TableHead>
            <TableHead>Просрочено</TableHead>
            <TableHead>Загрузка</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(profiles ?? []).length === 0 && <TableEmpty colSpan={7} />}
          {(profiles ?? []).map((profile) => {
            const load = loadByEmployee.get(profile.id);
            return (
              <TableRow key={profile.id}>
                <TableCell className="font-medium text-neutral-900">
                  <Link
                    href={`/employees/${profile.id}`}
                    className="hover:underline"
                  >
                    {profile.full_name}
                  </Link>
                </TableCell>
                <TableCell>{USER_ROLE_LABEL[profile.role]}</TableCell>
                <TableCell>{profile.position_title ?? "—"}</TableCell>
                <TableCell>
                  {activeProjectsByEmployee.get(profile.id) ?? 0}
                </TableCell>
                <TableCell>{load?.today ?? 0}</TableCell>
                <TableCell>{load?.overdue ?? 0}</TableCell>
                <TableCell>{load?.open ?? 0}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
