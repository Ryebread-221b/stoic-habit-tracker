import sqlite3
from dataclasses import dataclass
from datetime import date, datetime, timedelta
import tkinter as tk
from tkinter import messagebox, ttk
from typing import Optional

DB_PATH = "goals.db"
DATE_FORMAT = "%Y-%m-%d"
DEFAULT_HABITS = [
    "ランニング",
    "勉強",
    "断酒",
    "健康な食事",
    "英語の勉強",
    "筋トレ",
]


@dataclass
class Goal:
    id: int
    goal_date: str
    title: str
    completed: int


class GoalRepository:
    def __init__(self, db_path: str) -> None:
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
        self._create_table()

    def _create_table(self) -> None:
        self.conn.execute(
            """
            CREATE TABLE IF NOT EXISTS goals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                goal_date TEXT NOT NULL,
                title TEXT NOT NULL,
                completed INTEGER NOT NULL DEFAULT 0
            )
            """
        )
        self.conn.commit()

    def add_goal(self, goal_date: str, title: str) -> None:
        self.conn.execute(
            "INSERT INTO goals (goal_date, title, completed) VALUES (?, ?, 0)",
            (goal_date, title.strip()),
        )
        self.conn.commit()

    def delete_goal(self, goal_id: int) -> None:
        self.conn.execute("DELETE FROM goals WHERE id = ?", (goal_id,))
        self.conn.commit()

    def set_completed(self, goal_id: int, completed: bool) -> None:
        self.conn.execute(
            "UPDATE goals SET completed = ? WHERE id = ?", (1 if completed else 0, goal_id)
        )
        self.conn.commit()

    def list_by_date(self, goal_date: str) -> list[Goal]:
        rows = self.conn.execute(
            "SELECT id, goal_date, title, completed FROM goals WHERE goal_date = ? ORDER BY id",
            (goal_date,),
        ).fetchall()
        return [Goal(**dict(row)) for row in rows]

    def stats(self, start_date: str, end_date: str) -> tuple[int, int]:
        row = self.conn.execute(
            """
            SELECT
                COUNT(*) AS total,
                COALESCE(SUM(completed), 0) AS done
            FROM goals
            WHERE goal_date BETWEEN ? AND ?
            """,
            (start_date, end_date),
        ).fetchone()
        return int(row["done"]), int(row["total"])

    def stats_by_titles(
        self, start_date: str, end_date: str, titles: list[str]
    ) -> dict[str, tuple[int, int]]:
        if not titles:
            return {}

        placeholders = ",".join(["?"] * len(titles))
        rows = self.conn.execute(
            f"""
            SELECT
                title,
                COUNT(*) AS total,
                COALESCE(SUM(completed), 0) AS done
            FROM goals
            WHERE goal_date BETWEEN ? AND ?
              AND title IN ({placeholders})
            GROUP BY title
            """,
            (start_date, end_date, *titles),
        ).fetchall()

        result = {title: (0, 0) for title in titles}
        for row in rows:
            result[row["title"]] = (int(row["done"]), int(row["total"]))
        return result


class PieChart(ttk.Frame):
    def __init__(self, master: tk.Misc, title: str) -> None:
        super().__init__(master)
        self.canvas = tk.Canvas(self, width=220, height=220, highlightthickness=0)
        self.canvas.pack()
        self.label_title = ttk.Label(self, text=title, font=("Helvetica", 12, "bold"))
        self.label_title.place(x=10, y=8)
        self.label_value = ttk.Label(self, text="0/0 (0%)", font=("Helvetica", 10))
        self.label_value.pack(pady=(2, 0))

    def render(self, done: int, total: int) -> None:
        self.canvas.delete("all")

        x0, y0, x1, y1 = 20, 20, 200, 200
        self.canvas.create_oval(x0, y0, x1, y1, fill="#e5e7eb", outline="")

        ratio = (done / total) if total > 0 else 0.0
        angle = ratio * 360
        if angle > 0:
            self.canvas.create_arc(
                x0,
                y0,
                x1,
                y1,
                start=90,
                extent=-angle,
                fill="#16a34a",
                outline="",
            )

        self.canvas.create_oval(60, 60, 160, 160, fill="#ffffff", outline="")
        percent = int(round(ratio * 100))
        self.canvas.create_text(
            110,
            106,
            text=f"{percent}%",
            font=("Helvetica", 18, "bold"),
            fill="#111827",
        )

        self.canvas.create_rectangle(30, 205, 45, 220, fill="#16a34a", outline="")
        self.canvas.create_text(95, 212, text="達成", anchor="w", fill="#111827")
        self.canvas.create_rectangle(130, 205, 145, 220, fill="#e5e7eb", outline="")
        self.canvas.create_text(175, 212, text="未達", anchor="w", fill="#111827")

        self.label_value.config(text=f"{done}/{total} ({percent}%)")


class App(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("Stoic Goals Tracker")
        self.geometry("980x700")
        self.resizable(False, False)

        self.repo = GoalRepository(DB_PATH)
        self.selected_date = date.today()

        self.goal_vars: list[tuple[tk.BooleanVar, int]] = []

        self._build_ui()
        self.refresh_all()

    def _build_ui(self) -> None:
        root = ttk.Frame(self, padding=16)
        root.pack(fill="both", expand=True)

        header = ttk.Label(
            root,
            text="毎日を積み上げる目標トラッカー",
            font=("Helvetica", 18, "bold"),
        )
        header.pack(anchor="w")

        controls = ttk.Frame(root)
        controls.pack(fill="x", pady=(12, 8))

        ttk.Label(controls, text="日付 (YYYY-MM-DD):").pack(side="left")
        self.date_var = tk.StringVar(value=self.selected_date.strftime(DATE_FORMAT))
        self.date_entry = ttk.Entry(controls, textvariable=self.date_var, width=14)
        self.date_entry.pack(side="left", padx=8)
        ttk.Button(controls, text="読み込み", command=self.on_change_date).pack(side="left")
        ttk.Button(controls, text="今日", command=self.go_today).pack(side="left", padx=(8, 0))

        add_row = ttk.Frame(root)
        add_row.pack(fill="x", pady=(0, 10))

        self.goal_text_var = tk.StringVar()
        ttk.Entry(add_row, textvariable=self.goal_text_var).pack(side="left", fill="x", expand=True)
        ttk.Button(add_row, text="目標を追加", command=self.add_goal).pack(side="left", padx=8)

        habit_row = ttk.Frame(root)
        habit_row.pack(fill="x", pady=(0, 10))
        ttk.Label(habit_row, text="定番目標:").pack(side="left")
        for habit in DEFAULT_HABITS:
            ttk.Button(
                habit_row,
                text=habit,
                command=lambda h=habit: self.add_habit_goal(h),
            ).pack(side="left", padx=3)

        content = ttk.Frame(root)
        content.pack(fill="both", expand=True)

        left = ttk.Labelframe(content, text="今日の目標", padding=12)
        left.pack(side="left", fill="both", expand=True, padx=(0, 8))

        self.goal_list_frame = ttk.Frame(left)
        self.goal_list_frame.pack(fill="both", expand=True)

        right = ttk.Labelframe(content, text="達成率", padding=12)
        right.pack(side="left", fill="y", padx=(8, 0))

        self.weekly_chart = PieChart(right, "週間達成")
        self.weekly_chart.pack(pady=(0, 14))

        self.monthly_chart = PieChart(right, "月間達成")
        self.monthly_chart.pack()

        history_frame = ttk.Labelframe(right, text="項目別の週/月達成", padding=8)
        history_frame.pack(fill="both", expand=True, pady=(14, 0))
        self.history_table = ttk.Treeview(
            history_frame,
            columns=("habit", "weekly", "monthly"),
            show="headings",
            height=8,
        )
        self.history_table.heading("habit", text="項目")
        self.history_table.heading("weekly", text="週")
        self.history_table.heading("monthly", text="月")
        self.history_table.column("habit", width=140, anchor="w")
        self.history_table.column("weekly", width=95, anchor="center")
        self.history_table.column("monthly", width=95, anchor="center")
        self.history_table.pack(fill="both", expand=True)

    def parse_selected_date(self) -> Optional[date]:
        raw = self.date_var.get().strip()
        try:
            return datetime.strptime(raw, DATE_FORMAT).date()
        except ValueError:
            messagebox.showerror("日付エラー", "日付形式は YYYY-MM-DD で入力してください。")
            return None

    def on_change_date(self) -> None:
        parsed = self.parse_selected_date()
        if parsed is None:
            return
        self.selected_date = parsed
        self.refresh_all()

    def go_today(self) -> None:
        self.selected_date = date.today()
        self.date_var.set(self.selected_date.strftime(DATE_FORMAT))
        self.refresh_all()

    def add_goal(self) -> None:
        title = self.goal_text_var.get().strip()
        if not title:
            return
        parsed = self.parse_selected_date()
        if parsed is None:
            return

        self.repo.add_goal(parsed.strftime(DATE_FORMAT), title)
        self.goal_text_var.set("")
        self.refresh_all()

    def add_habit_goal(self, habit: str) -> None:
        parsed = self.parse_selected_date()
        if parsed is None:
            return
        self.repo.add_goal(parsed.strftime(DATE_FORMAT), habit)
        self.refresh_all()

    def toggle_goal(self, goal_id: int, checked: tk.BooleanVar) -> None:
        self.repo.set_completed(goal_id, checked.get())
        self.refresh_stats()

    def remove_goal(self, goal_id: int) -> None:
        self.repo.delete_goal(goal_id)
        self.refresh_all()

    def clear_goal_list(self) -> None:
        for child in self.goal_list_frame.winfo_children():
            child.destroy()
        self.goal_vars.clear()

    def refresh_goal_list(self) -> None:
        self.clear_goal_list()
        rows = self.repo.list_by_date(self.selected_date.strftime(DATE_FORMAT))

        if not rows:
            ttk.Label(self.goal_list_frame, text="目標がまだありません。最初の1つを追加しましょう。").pack(anchor="w")
            return

        for goal in rows:
            row = ttk.Frame(self.goal_list_frame)
            row.pack(fill="x", pady=4)

            var = tk.BooleanVar(value=bool(goal.completed))
            chk = ttk.Checkbutton(
                row,
                text=goal.title,
                variable=var,
                command=lambda g_id=goal.id, v=var: self.toggle_goal(g_id, v),
            )
            chk.pack(side="left", fill="x", expand=True)

            del_btn = ttk.Button(row, text="削除", width=6, command=lambda g_id=goal.id: self.remove_goal(g_id))
            del_btn.pack(side="right")

            self.goal_vars.append((var, goal.id))

    def week_range(self, day: date) -> tuple[date, date]:
        monday = day - timedelta(days=day.weekday())
        sunday = monday + timedelta(days=6)
        return monday, sunday

    def month_range(self, day: date) -> tuple[date, date]:
        first = day.replace(day=1)
        if day.month == 12:
            next_month = day.replace(year=day.year + 1, month=1, day=1)
        else:
            next_month = day.replace(month=day.month + 1, day=1)
        last = next_month - timedelta(days=1)
        return first, last

    def refresh_stats(self) -> None:
        w_start, w_end = self.week_range(self.selected_date)
        m_start, m_end = self.month_range(self.selected_date)

        w_done, w_total = self.repo.stats(
            w_start.strftime(DATE_FORMAT), w_end.strftime(DATE_FORMAT)
        )
        m_done, m_total = self.repo.stats(
            m_start.strftime(DATE_FORMAT), m_end.strftime(DATE_FORMAT)
        )

        self.weekly_chart.render(w_done, w_total)
        self.monthly_chart.render(m_done, m_total)
        self.refresh_history_table(w_start, w_end, m_start, m_end)

    def render_cell(self, done: int, total: int) -> str:
        if total == 0:
            return "- (-/-)"
        percent = int(round((done / total) * 100))
        return f"{percent}% ({done}/{total})"

    def refresh_history_table(
        self, w_start: date, w_end: date, m_start: date, m_end: date
    ) -> None:
        for row_id in self.history_table.get_children():
            self.history_table.delete(row_id)

        weekly = self.repo.stats_by_titles(
            w_start.strftime(DATE_FORMAT), w_end.strftime(DATE_FORMAT), DEFAULT_HABITS
        )
        monthly = self.repo.stats_by_titles(
            m_start.strftime(DATE_FORMAT), m_end.strftime(DATE_FORMAT), DEFAULT_HABITS
        )

        for habit in DEFAULT_HABITS:
            w_done, w_total = weekly.get(habit, (0, 0))
            m_done, m_total = monthly.get(habit, (0, 0))
            self.history_table.insert(
                "",
                "end",
                values=(
                    habit,
                    self.render_cell(w_done, w_total),
                    self.render_cell(m_done, m_total),
                ),
            )

    def refresh_all(self) -> None:
        self.refresh_goal_list()
        self.refresh_stats()


if __name__ == "__main__":
    app = App()
    app.mainloop()
