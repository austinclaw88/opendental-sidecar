import { redirect } from "next/navigation";

// The old read-only appointments list grew into the schedule book.
export default function AppointmentsRedirect() {
  redirect("/schedule");
}
