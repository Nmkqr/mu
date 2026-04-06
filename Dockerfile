# إيقاف الحاوية القديمة
docker-compose down

# حذف cache Docker
docker system prune -a

# إعادة البناء
docker-compose build --no-cache

# التشغيل
docker-compose up -d

# مشاهدة اللوقز
docker-compose logs -f
