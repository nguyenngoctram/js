var Profile = Composer.RelationalModel.extend({
	relations: {
		projects: {
			type: Composer.HasMany,
			collection: 'Projects',
			forward_events: true
		}
	},

	// stores ALL data for the profile, synced once during init from server.
	// also used to indicate whether or not initial data sync has occured yet
	profile_data: false,

	init: function()
	{
	},

	load_data: function(options)
	{
		tagit.api.get('/profiles/users/'+tagit.user.id(), {}, {
			success: function(profile) {
				this.profile_data = profile;
				if(options.init) this.load(options);
				if(options.success) options.success(profile);
			}.bind(this),
			error: function(e) {
				barfr.barf('Error loading user profile: ', e);
				if(options.error) options.error(e);
			}
		});
	},

	load: function(options)
	{
		options || (options = {});
		this.clear({silent: true});
		this.get_sync_time();
		var projects = this.get('projects');
		var project_data = this.profile_data.projects;
		projects.load_projects(project_data);
		var project = null;
		this.loaded = true;
		if(options.project)
		{
			project = this.get('projects').find(function(p) {
				return p.get('title') == options.project.clean();
			});
		}
		if(!project) project = this.get('projects').first();
		if(!project) return;
		this.set_current_project(project);
	},

	get_current_project: function()
	{
		return this.get('current_project', false);
	},

	set_current_project: function(obj, options)
	{
		options || (options = {});
		var cur = this.get_current_project();
		return this.set({current_project: obj}, options);
	},

	sync: function(options)
	{
		options || (options = {});
		var sync_time = this.get('sync_time', 9999999);
		tagit.api.post('/sync', {time: sync_time}, {
			success: function(sync) {
				this.set({sync_time: sync.time});
				sync.notes.each(function(note_data) {
					var project = this.get('projects').find_by_id(note_data.project_id);
					if(!project) return;
					var note = project.get('notes').find_by_id(note_data.id);
					if(note && note_data.deleted)
					{
						project.get('notes').remove(note);
						note.destroy({skip_sync: true});
						note.unbind();
					}
					else if(note)
					{
						note.set(note_data);
					}
					else if(!note_data.deleted)
					{
						project.get('notes').add(note_data);
					}
				}.bind(this));
			}.bind(this),
			error: function(e) {
				barfr.barf('Error syncing user profile with server: '+ e);
				if(options.error) options.error(e);
			}.bind(this)
		});
	},

	get_sync_time: function()
	{
		tagit.api.get('/sync', {}, {
			success: function(time) {
				this.set({sync_time: time});
			}.bind(this),
			error: function(e) {
				barfr.barf('Error syncing user profile with server: '+ e);
			}.bind(this)
		});
	}
});

