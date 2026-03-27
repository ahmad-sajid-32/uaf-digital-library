begin;

insert into library.admins (
  id,
  designation,
  created_at
)
select
  p.id,
  coalesce(
    nullif(
      regexp_replace(
        btrim(coalesce(u.raw_user_meta_data->>'designation', '')),
        '\s+',
        ' ',
        'g'
      ),
      ''
    ),
    case
      when lower(coalesce(p.full_name, '')) like '%administrator%'
        then regexp_replace(btrim(p.full_name), '\s+', ' ', 'g')
      else 'Administrator'
    end
  ) as designation,
  p.created_at
from library.profiles p
join auth.users u
  on u.id = p.id
left join library.admins a
  on a.id = p.id
where p.role = 'admin'
  and a.id is null;

commit;
