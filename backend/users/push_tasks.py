from __future__ import annotations

from celery import shared_task

from users.notifications import send_expo_notifications


@shared_task(queue="notifications", name="users.push_tasks.send_city_ranking_push")
def send_city_ranking_push(user_ids: list[int], city_name: str) -> dict:
    sent = send_expo_notifications(
        user_ids=user_ids,
        title="Ranking miasta",
        body=f"{city_name}: sprawdz nowy ranking i swoja pozycje.",
        data={"type": "city_ranking"},
    )
    return {"sent": sent}


@shared_task(queue="notifications", name="users.push_tasks.send_quest_push")
def send_quest_push(user_ids: list[int], quest_name: str) -> dict:
    sent = send_expo_notifications(
        user_ids=user_ids,
        title="Nowy quest",
        body=f"Quest {quest_name} czeka w CityHub.",
        data={"type": "quest"},
    )
    return {"sent": sent}


@shared_task(queue="notifications", name="users.push_tasks.send_season_end_push")
def send_season_end_push(user_ids: list[int], event_title: str) -> dict:
    sent = send_expo_notifications(
        user_ids=user_ids,
        title="Koniec sezonu",
        body=f"Sezon {event_title} zakonczony. Sprawdz wyniki.",
        data={"type": "season_end"},
    )
    return {"sent": sent}
