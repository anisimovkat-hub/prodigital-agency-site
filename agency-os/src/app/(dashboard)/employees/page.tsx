import Link from "next/link";

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
import { todayISO } from "@/lib/format";

export default async function EmployeesPage() {
  const supabase = await createClient();

  const [{ data: profiles }, { data: tasks }, { data: members }] =
    await Promise.all([
      supabase.from("profiles").select("*").order("full_name"),
      supabase.from("tasks").select("assignee_id,status,due_date"),
      supabase
        .from("project_members")
        .select("profile_id, project:projects(stage)"),
    ]);

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
