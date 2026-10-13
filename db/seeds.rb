# Cria os registros necessários para executar a aplicação em qualquer ambiente.
# O seed é idempotente e pode ser executado novamente sem duplicar o administrador.

# Lê as credenciais fora do repositório para não versionar uma senha real.
admin_email = ENV["ADMIN_EMAIL"].to_s.strip
admin_password = ENV["ADMIN_PASSWORD"].to_s

if admin_email.empty? || admin_password.empty?
  raise ArgumentError, "ADMIN_EMAIL e ADMIN_PASSWORD devem ser informados para criar o administrador"
end

# O e-mail identifica exclusivamente a conta que o seed pode administrar.
admin = User.find_or_initialize_by(email: admin_email)
admin.role = :admin
admin.password = admin_password
admin.password_confirmation = admin_password
admin.save!
