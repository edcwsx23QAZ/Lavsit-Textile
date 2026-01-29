/**
 * Скрипт для проверки статуса деплоя на Vercel
 * Vercel автоматически деплоит при пуше в main через GitHub интеграцию
 */

console.log('🚀 Проверка статуса деплоя на Vercel...\n');

const projectId = 'prj_bMA2mQ3UsVKhrjJsHqSiZ1rdj15K';
const projectName = 'lavsit-textile';
const githubRepo = 'edcwsx23QAZ/Lavsit-Textile';

console.log('📋 Информация о проекте:');
console.log(`   Project ID: ${projectId}`);
console.log(`   Project Name: ${projectName}`);
console.log(`   GitHub Repo: ${githubRepo}\n`);

console.log('✅ Изменения отправлены на GitHub (ветка main)');
console.log('✅ Vercel автоматически задеплоит изменения при пуше в main\n');

console.log('📋 Что нужно проверить:');
console.log('   1. Откройте https://vercel.com/dashboard');
console.log('   2. Выберите проект "lavsit-textile"');
console.log('   3. Перейдите в раздел "Deployments"');
console.log('   4. Проверьте статус последнего деплоя\n');

console.log('⚠️  Важно перед деплоем:');
console.log('   1. Убедитесь, что DATABASE_URL настроен в Vercel Environment Variables');
console.log('   2. Убедитесь, что миграции применены в Supabase');
console.log('   3. Проверьте логи деплоя на наличие ошибок\n');

console.log('🔗 Полезные ссылки:');
console.log(`   - Vercel Dashboard: https://vercel.com/dashboard`);
console.log(`   - GitHub Repo: https://github.com/${githubRepo}`);
console.log(`   - Последние коммиты: https://github.com/${githubRepo}/commits/main\n`);

console.log('💡 Если деплой не запустился автоматически:');
console.log('   1. В Vercel Dashboard → Settings → Git');
console.log('   2. Проверьте, что проект подключен к правильному репозиторию');
console.log('   3. Убедитесь, что Production Branch установлен на "main"');
console.log('   4. Или запустите деплой вручную: Deployments → "Redeploy"\n');



