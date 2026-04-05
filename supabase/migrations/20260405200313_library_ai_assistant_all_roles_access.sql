begin;

drop policy if exists admin_owner_manage_ai_conversations on library.ai_conversations;
drop policy if exists admin_owner_manage_ai_messages on library.ai_messages;
drop policy if exists admin_owner_manage_ai_message_citations on library.ai_message_citations;

drop policy if exists owner_manage_ai_conversations on library.ai_conversations;
create policy owner_manage_ai_conversations
on library.ai_conversations
for all
using (
    owner_user_id = auth.uid()
)
with check (
    owner_user_id = auth.uid()
);

drop policy if exists owner_manage_ai_messages on library.ai_messages;
create policy owner_manage_ai_messages
on library.ai_messages
for all
using (
    exists (
        select 1
        from library.ai_conversations c
        where c.id = conversation_id
          and c.owner_user_id = auth.uid()
    )
)
with check (
    exists (
        select 1
        from library.ai_conversations c
        where c.id = conversation_id
          and c.owner_user_id = auth.uid()
    )
);

drop policy if exists owner_manage_ai_message_citations on library.ai_message_citations;
create policy owner_manage_ai_message_citations
on library.ai_message_citations
for all
using (
    exists (
        select 1
        from library.ai_messages m
        join library.ai_conversations c
            on c.id = m.conversation_id
        where m.id = message_id
          and c.owner_user_id = auth.uid()
    )
)
with check (
    exists (
        select 1
        from library.ai_messages m
        join library.ai_conversations c
            on c.id = m.conversation_id
        where m.id = message_id
          and c.owner_user_id = auth.uid()
    )
);

commit;
